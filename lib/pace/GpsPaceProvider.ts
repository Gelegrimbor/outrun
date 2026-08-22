import * as Location from 'expo-location';
import { setBackgroundLocationConsumer } from '@/lib/session/backgroundTracking';
import type { PaceProvider, PaceSample } from './PaceProvider';

const SMOOTHING_WINDOW_MS = 3000;

interface Fix {
  latitude: number;
  longitude: number;
  timestamp: number;
}

function haversineMeters(a: Fix, b: Fix): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// v1 PaceProvider: wraps expo-location's foreground position watch, smoothed
// over a rolling 3-second window of Haversine distance / elapsed time (per
// the build spec) rather than trusting raw coords.speed, which some Android
// GPS chipsets report as null/unreliable at low speeds.
export class GpsPaceProvider implements PaceProvider {
  private subscription: Location.LocationSubscription | null = null;
  private listeners = new Set<(sample: PaceSample) => void>();
  private fixes: Fix[] = [];
  private totalDistanceM = 0;
  private startedAt: number | null = null;
  private pausedAt: number | null = null;
  private latestAccuracyM: number | null = null;
  private latestSpeedMps = 0;
  // While the Android foreground service is running, the same fused fixes
  // can arrive through BOTH the foreground watch callback and the
  // background task. Deduping on fix timestamp makes double-delivery
  // harmless (and drops out-of-order stragglers).
  private lastFixTimestamp = 0;

  async start(): Promise<void> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Location permission was not granted.');
    }

    this.fixes = [];
    this.totalDistanceM = 0;
    this.latestSpeedMps = 0;
    this.startedAt = Date.now();
    this.pausedAt = null;
    this.lastFixTimestamp = 0;

    await this.watch();
  }

  private async watch(): Promise<void> {
    this.subscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (location) => this.handleLocation(location)
    );
    // Fixes delivered via the Android background task (screen off /
    // backgrounded) route into the same math as the foreground watch.
    setBackgroundLocationConsumer((locations) => {
      for (const location of locations) {
        this.handleLocation(location);
      }
    });
  }

  pause(): void {
    if (this.pausedAt !== null) return;
    this.subscription?.remove();
    this.subscription = null;
    setBackgroundLocationConsumer(null);
    this.pausedAt = Date.now();
    this.latestSpeedMps = 0;
  }

  async resume(): Promise<void> {
    if (this.pausedAt === null) return;
    // Shift the start time forward so paused time doesn't count as elapsed.
    if (this.startedAt !== null) {
      this.startedAt += Date.now() - this.pausedAt;
    }
    this.pausedAt = null;
    // Drop the pre-pause fix window: the first new fix then has no
    // predecessor, so distance walked during the pause never counts.
    this.fixes = [];
    await this.watch();
  }

  stop(): void {
    this.subscription?.remove();
    this.subscription = null;
    setBackgroundLocationConsumer(null);
    this.listeners.clear();
  }

  getCurrentSpeed(): number {
    return this.latestSpeedMps;
  }

  subscribe(listener: (sample: PaceSample) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private handleLocation(location: Location.LocationObject) {
    // Skip duplicates (watch + background task can deliver the same fix)
    // and out-of-order stragglers.
    if (location.timestamp <= this.lastFixTimestamp) return;
    this.lastFixTimestamp = location.timestamp;

    const fix: Fix = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      timestamp: location.timestamp,
    };
    this.latestAccuracyM = location.coords.accuracy ?? null;

    if (this.fixes.length > 0) {
      this.totalDistanceM += haversineMeters(this.fixes[this.fixes.length - 1], fix);
    }
    this.fixes.push(fix);

    const cutoff = fix.timestamp - SMOOTHING_WINDOW_MS;
    while (this.fixes.length > 1 && this.fixes[0].timestamp < cutoff) {
      this.fixes.shift();
    }

    this.latestSpeedMps = this.computeSmoothedSpeed();

    const sample: PaceSample = {
      speedMps: this.latestSpeedMps,
      totalDistanceM: this.totalDistanceM,
      elapsedS: this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0,
      accuracyM: this.latestAccuracyM,
      timestamp: fix.timestamp,
    };
    this.listeners.forEach((listener) => listener(sample));
  }

  private computeSmoothedSpeed(): number {
    if (this.fixes.length < 2) return 0;
    const first = this.fixes[0];
    const last = this.fixes[this.fixes.length - 1];
    const dtS = (last.timestamp - first.timestamp) / 1000;
    if (dtS <= 0) return 0;

    let distance = 0;
    for (let i = 1; i < this.fixes.length; i++) {
      distance += haversineMeters(this.fixes[i - 1], this.fixes[i]);
    }
    return distance / dtS;
  }
}
