// Provider-agnostic pace source. v1 wraps GPS (see GpsPaceProvider); a future
// Bluetooth sensor provider (treadmill/bike, Phase 10) can implement this
// same interface without the live-session/game layer knowing the difference.
export interface PaceSample {
  /** Smoothed speed over the provider's rolling window, meters/second. */
  speedMps: number;
  /** Cumulative distance covered since start(), meters. */
  totalDistanceM: number;
  /** Seconds since start(). */
  elapsedS: number;
  /** Horizontal accuracy of the latest fix, meters, if known. */
  accuracyM: number | null;
  /** ms epoch of this sample. */
  timestamp: number;
}

export interface PaceProvider {
  start(): Promise<void>;
  stop(): void;
  /** Instantaneous read of the latest smoothed speed, meters/second. */
  getCurrentSpeed(): number;
  /** Returns an unsubscribe function. */
  subscribe(listener: (sample: PaceSample) => void): () => void;
}
