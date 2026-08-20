import { Accelerometer } from 'expo-sensors';
import type { EventSubscription } from 'expo-modules-core';
import type { PaceProvider, PaceSample } from './PaceProvider';

// Indoor/treadmill pace estimate: peak-detect steps from the accelerometer
// and convert cadence -> speed via a stride-length formula. This is a
// genuine estimate, not a measurement -- there's no ground truth like GPS
// or a real sensor to compare against, so it's tuned to be reasonable
// rather than precise. Real precision arrives with Bluetooth sensor support
// (the next piece of this phase), which reads actual treadmill/bike data.
//
// Deliberately uses raw Accelerometer + our own peak detection rather than
// expo-sensors' Pedometer API, for two reasons: (1) it works regardless of
// how the phone is oriented -- pocketed, handheld, or propped on a
// treadmill console (the spec's reference use case) -- since detection runs
// on the acceleration vector's magnitude rather than a fixed axis, and (2)
// on iOS, Pedometer requires NSMotionUsageDescription and a Motion &
// Fitness permission prompt; raw accelerometer needs neither.

const SAMPLE_INTERVAL_MS = 50; // 20Hz -- well above step-cadence Nyquist (max ~4 steps/s)
// EMA low-pass cutoff (Hz) = alpha / (2*pi*dt*(1-alpha)). At dt=0.05s, the
// original 0.3 gave a ~1.36Hz cutoff -- *below* normal walking cadence
// (~1.5-2.5Hz), so the filter meant to strip sensor noise was instead
// attenuating the actual step signal before it reached the threshold check.
// 0.5 gives ~3.18Hz, comfortably above walking (and brisk jogging) cadence
// while still smoothing genuinely high-frequency noise.
const LOWPASS_ALPHA = 0.5;
const GRAVITY_G = 1.0;
// Dynamic-acceleration swing required to count as a step. Normal walking
// (pocket or natural arm swing) typically swings ~0.05-0.15g; the original
// 0.15 sat at the top of that range, so it only caught the hardest steps
// or outright shakes. Lowered to register normal gait -- if this turns out
// too sensitive (false steps while just standing/fidgeting), the dev-only
// signal readout on the live HUD in step mode shows the live g-value next
// to this threshold, so it can be retuned from a real walk without guessing.
const STEP_THRESHOLD_G = 0.05;
const MIN_STEP_INTERVAL_MS = 300; // refractory period -- caps cadence at 200 steps/min, well above normal walking (~100-120 spm); not the bottleneck here
const CADENCE_WINDOW_MS = 4000; // rolling window for cadence smoothing

const FALLBACK_HEIGHT_CM = 170;

// Commonly-used pedometer approximation for walking stride length.
// Running strides lengthen with pace in reality; this provider doesn't
// model that (out of scope for a "basic" indoor mode), so running
// estimates will run a bit low at faster paces.
function strideLengthM(heightCm: number, gender: string | null): number {
  const factor = gender === 'female' ? 0.413 : 0.415;
  return (heightCm * factor) / 100;
}

export class StepPaceProvider implements PaceProvider {
  private readonly strideM: number;
  private subscription: EventSubscription | null = null;
  private listeners = new Set<(sample: PaceSample) => void>();

  private smoothedMagnitudeG = GRAVITY_G;
  private aboveThreshold = false;
  private lastStepAt: number | null = null;
  private stepTimestamps: number[] = [];
  private latestDynamicG = 0;
  private stepCount = 0;

  private totalDistanceM = 0;
  private startedAt: number | null = null;
  private pausedAt: number | null = null;
  private latestSpeedMps = 0;

  constructor(heightCm: number | null, gender: string | null = null) {
    this.strideM = strideLengthM(heightCm ?? FALLBACK_HEIGHT_CM, gender);
  }

  async start(): Promise<void> {
    const available = await Accelerometer.isAvailableAsync();
    if (!available) {
      throw new Error('Accelerometer is not available on this device.');
    }

    this.smoothedMagnitudeG = GRAVITY_G;
    this.aboveThreshold = false;
    this.lastStepAt = null;
    this.stepTimestamps = [];
    this.latestDynamicG = 0;
    this.stepCount = 0;
    this.totalDistanceM = 0;
    this.latestSpeedMps = 0;
    this.startedAt = Date.now();
    this.pausedAt = null;

    this.watch();
  }

  private watch(): void {
    Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
    this.subscription = Accelerometer.addListener((data) => this.handleSample(data));
  }

  pause(): void {
    if (this.pausedAt !== null) return;
    this.subscription?.remove();
    this.subscription = null;
    this.pausedAt = Date.now();
    this.latestSpeedMps = 0;
  }

  async resume(): Promise<void> {
    if (this.pausedAt === null) return;
    if (this.startedAt !== null) {
      this.startedAt += Date.now() - this.pausedAt;
    }
    this.pausedAt = null;
    // Drop step history across the pause, same reasoning as GpsPaceProvider:
    // movement during a pause shouldn't feed the post-resume cadence.
    this.stepTimestamps = [];
    this.aboveThreshold = false;
    this.watch();
  }

  stop(): void {
    this.subscription?.remove();
    this.subscription = null;
    this.listeners.clear();
  }

  getCurrentSpeed(): number {
    return this.latestSpeedMps;
  }

  subscribe(listener: (sample: PaceSample) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Dev-tuning aid: the live dynamic-acceleration signal alongside the
   * threshold it's compared against, and steps counted so far. Lets the
   * threshold be retuned from what a real walk actually looks like instead
   * of guessing blind between rebuilds. Not part of the PaceProvider
   * interface -- GPS has no equivalent concept. */
  getDebugInfo(): { dynamicG: number; thresholdG: number; stepCount: number } {
    return {
      dynamicG: this.latestDynamicG,
      thresholdG: STEP_THRESHOLD_G,
      stepCount: this.stepCount,
    };
  }

  private handleSample(data: { x: number; y: number; z: number }): void {
    const now = Date.now();
    const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
    this.smoothedMagnitudeG += LOWPASS_ALPHA * (magnitude - this.smoothedMagnitudeG);
    const dynamicG = this.smoothedMagnitudeG - GRAVITY_G;
    this.latestDynamicG = dynamicG;

    // Rising-edge threshold crossing, with a refractory period so one
    // physical step (one up-down cycle) can't register as several.
    if (!this.aboveThreshold && dynamicG >= STEP_THRESHOLD_G) {
      this.aboveThreshold = true;
      const sinceLastStep = this.lastStepAt ? now - this.lastStepAt : Infinity;
      if (sinceLastStep >= MIN_STEP_INTERVAL_MS) {
        this.lastStepAt = now;
        this.stepTimestamps.push(now);
        this.totalDistanceM += this.strideM;
        this.stepCount += 1;
      }
    } else if (this.aboveThreshold && dynamicG < STEP_THRESHOLD_G * 0.5) {
      // Hysteresis: only re-arm once the signal drops well below threshold,
      // so noise sitting right at the line doesn't retrigger.
      this.aboveThreshold = false;
    }

    const cutoff = now - CADENCE_WINDOW_MS;
    while (this.stepTimestamps.length > 0 && this.stepTimestamps[0] < cutoff) {
      this.stepTimestamps.shift();
    }

    this.latestSpeedMps = this.computeSpeed(now);

    const sample: PaceSample = {
      speedMps: this.latestSpeedMps,
      totalDistanceM: this.totalDistanceM,
      elapsedS: this.startedAt ? (now - this.startedAt) / 1000 : 0,
      accuracyM: null, // no ground-truth concept for a step estimate
      timestamp: now,
    };
    this.listeners.forEach((listener) => listener(sample));
  }

  private computeSpeed(now: number): number {
    if (this.stepTimestamps.length < 2) return 0;
    // No step in the last ~1.5x the min step interval at max cadence means
    // motion has stopped -- decay to 0 rather than reporting a stale window.
    if (this.lastStepAt !== null && now - this.lastStepAt > MIN_STEP_INTERVAL_MS * 3) {
      return 0;
    }
    const first = this.stepTimestamps[0];
    const last = this.stepTimestamps[this.stepTimestamps.length - 1];
    const dtS = (last - first) / 1000;
    if (dtS <= 0) return 0;
    const cadenceStepsPerSec = (this.stepTimestamps.length - 1) / dtS;
    return cadenceStepsPerSec * this.strideM;
  }
}
