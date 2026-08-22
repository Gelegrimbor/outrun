import { Pedometer } from 'expo-sensors';
import type { EventSubscription } from 'expo-modules-core';
import type { PaceProvider, PaceSample } from './PaceProvider';

// Indoor/treadmill pace estimate: uses the platform's own step counter
// (Core Motion on iOS, TYPE_STEP_COUNTER on Android) and converts step
// cadence -> speed via a stride-length formula. This is a genuine estimate,
// not a measurement -- there's no ground truth like GPS to compare against.
// Real precision arrives with Bluetooth sensor support (the next piece of
// this phase), which reads actual treadmill/bike data.
//
// This used to be a hand-rolled accelerometer peak-detector, switched to
// expo-sensors' Pedometer after two tuning rounds both failed on real
// walks -- see git history / SETUP.md for why. Outsourcing step detection
// to the platform's own algorithm trades a permission prompt
// (ACTIVITY_RECOGNITION on Android 10+, Motion & Fitness on iOS) for
// detection logic Apple/Google have already validated far more than this
// could be hand-tuned. Known tradeoff, not risk-free: Android's
// watchStepCount has a documented history of callbacks firing late or
// inconsistently on some devices/OS versions -- see SETUP.md.
//
// watchStepCount's callback gives a CUMULATIVE step count since the
// subscription started (confirmed by reading both native implementations
// directly), not a per-step event -- there's no per-step timestamp on
// either platform. Cadence is therefore derived from successive callback
// deltas (steps and time between callbacks), not a continuous stream, so
// it updates only when the platform reports new steps, which can lag
// behind the actual walking rhythm more than the old 20Hz accelerometer
// signal did.

const CADENCE_WINDOW_MS = 6000; // rolling window of step-count callbacks for cadence smoothing
const STALE_AFTER_MS = 3000; // no callback in this long -> decay speed to 0
const HEARTBEAT_MS = 1000; // keeps elapsed time and decay ticking between step callbacks

const FALLBACK_HEIGHT_CM = 170;

// Commonly-used pedometer approximation for walking stride length.
// Running strides lengthen with pace in reality; this provider doesn't
// model that (out of scope for a "basic" indoor mode), so running
// estimates will run a bit low at faster paces.
function strideLengthM(heightCm: number, gender: string | null): number {
  const factor = gender === 'female' ? 0.413 : 0.415;
  return (heightCm * factor) / 100;
}

interface CountSample {
  steps: number; // cumulative since the current watch segment started
  timestamp: number;
}

export class StepPaceProvider implements PaceProvider {
  private readonly strideM: number;
  private subscription: EventSubscription | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(sample: PaceSample) => void>();

  private history: CountSample[] = [];
  // Distance banked from watch segments before the current one (i.e. from
  // before a pause) -- each pause/resume starts a fresh cumulative count
  // natively, so distance-so-far has to be preserved across that reset.
  private distanceBeforeSegmentM = 0;
  private latestSegmentSteps = 0;
  private lastCallbackAt: number | null = null;

  private startedAt: number | null = null;
  private pausedAt: number | null = null;
  private latestSpeedMps = 0;

  constructor(heightCm: number | null, gender: string | null = null) {
    this.strideM = strideLengthM(heightCm ?? FALLBACK_HEIGHT_CM, gender);
  }

  async start(): Promise<void> {
    const available = await Pedometer.isAvailableAsync();
    if (!available) {
      throw new Error('Step counting is not available on this device.');
    }
    const { status } = await Pedometer.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Motion & Fitness permission was not granted.');
    }

    this.history = [];
    this.distanceBeforeSegmentM = 0;
    this.latestSegmentSteps = 0;
    this.lastCallbackAt = null;
    this.latestSpeedMps = 0;
    this.startedAt = Date.now();
    this.pausedAt = null;

    this.watch();
  }

  private watch(): void {
    this.history = [];
    this.latestSegmentSteps = 0;
    this.subscription = Pedometer.watchStepCount((result) => this.handleStepCount(result.steps));
    this.heartbeat = setInterval(() => this.emitSample(), HEARTBEAT_MS);
  }

  pause(): void {
    if (this.pausedAt !== null) return;
    // Bank distance from this segment before it resets on resume.
    this.distanceBeforeSegmentM += this.latestSegmentSteps * this.strideM;
    this.subscription?.remove();
    this.subscription = null;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.pausedAt = Date.now();
    this.latestSpeedMps = 0;
  }

  async resume(): Promise<void> {
    if (this.pausedAt === null) return;
    if (this.startedAt !== null) {
      this.startedAt += Date.now() - this.pausedAt;
    }
    this.pausedAt = null;
    this.watch();
  }

  stop(): void {
    this.subscription?.remove();
    this.subscription = null;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.listeners.clear();
  }

  getCurrentSpeed(): number {
    return this.latestSpeedMps;
  }

  subscribe(listener: (sample: PaceSample) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Tuning/diagnostic aid, shown directly on the live HUD in step mode
   * (see SETUP.md for why it's not gated behind a debug flag). Total steps
   * and time-since-last-callback are the two numbers that matter most for
   * telling "not walking enough to register" apart from "the platform's
   * step callback is lagging/stalled", which is a documented real
   * possibility on Android, not just a tuning question. */
  getDebugInfo(): { totalSteps: number; cadenceStepsPerMin: number; msSinceLastCallback: number | null } {
    const totalSteps = this.history.length > 0 ? this.latestSegmentSteps : 0;
    return {
      totalSteps,
      cadenceStepsPerMin: this.strideM > 0 ? (this.latestSpeedMps / this.strideM) * 60 : 0,
      msSinceLastCallback: this.lastCallbackAt !== null ? Date.now() - this.lastCallbackAt : null,
    };
  }

  private handleStepCount(cumulativeSteps: number): void {
    const now = Date.now();
    this.lastCallbackAt = now;
    this.latestSegmentSteps = cumulativeSteps;

    this.history.push({ steps: cumulativeSteps, timestamp: now });
    const cutoff = now - CADENCE_WINDOW_MS;
    while (this.history.length > 1 && this.history[0].timestamp < cutoff) {
      this.history.shift();
    }

    this.emitSample();
  }

  private emitSample(): void {
    const now = Date.now();
    this.latestSpeedMps = this.computeSpeed(now);

    const totalDistanceM = this.distanceBeforeSegmentM + this.latestSegmentSteps * this.strideM;
    const sample: PaceSample = {
      speedMps: this.latestSpeedMps,
      totalDistanceM,
      elapsedS: this.startedAt ? (now - this.startedAt) / 1000 : 0,
      accuracyM: null, // no ground-truth concept for a step estimate
      timestamp: now,
    };
    this.listeners.forEach((listener) => listener(sample));
  }

  private computeSpeed(now: number): number {
    // No step callback in a while -> treat as stopped rather than holding
    // the last computed speed forever.
    if (this.lastCallbackAt !== null && now - this.lastCallbackAt > STALE_AFTER_MS) {
      return 0;
    }
    if (this.history.length < 2) return 0;

    const first = this.history[0];
    const last = this.history[this.history.length - 1];
    const dtS = (last.timestamp - first.timestamp) / 1000;
    if (dtS <= 0) return 0;

    const cadenceStepsPerSec = (last.steps - first.steps) / dtS;
    return Math.max(cadenceStepsPerSec, 0) * this.strideM;
  }
}
