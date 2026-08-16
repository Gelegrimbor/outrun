import type { ActivityType } from '@/stores/sessionStore';

// All speeds in m/s, distances in meters, times in seconds.
//
// Tuning targets real GPS speed ranges from Phase 4 testing:
//   walk  ~0.8-1.7 m/s (3-6 km/h)
//   run   ~2.2-3.6 m/s (8-13 km/h)
//   cycle ~3.3-6.9 m/s (12-25 km/h)
// GPS speed at walking pace is noisy (±0.3 m/s between samples even at
// steady effort), so every response here is deliberately slow relative to
// that noise: the horde reacts to sustained effort changes, not jitter.

/** Baseline "keep the horde at bay" pace per activity. */
const BASE_TARGET_PACE: Record<ActivityType, number> = {
  walk: 1.25, // 4.5 km/h — a purposeful but not punishing walk
  run: 2.35, // 8.5 km/h — a sustainable jog
  cycle: 4.2, // 15 km/h — relaxed ride
};

/** The rolling target pace self-calibrates toward the player's own sustained
 * speed, but stays clamped to this band around the activity baseline so
 * dawdling can't make the chase trivial nor sprinting make it impossible. */
const TARGET_PACE_MIN_RATIO = 0.6;
const TARGET_PACE_MAX_RATIO = 1.4;
/** Time constant for that self-calibration. ~45s means one fast street
 * crossing won't ratchet your target up, but a sustained pace change will. */
const TARGET_PACE_TAU_S = 45;

/** Where the horde sits when you're exactly at target pace. */
const COMFORT_DISTANCE_M = 25;
/** Horde never falls further behind than this... */
const MAX_DISTANCE_M = 60;
/** ...and closer than this counts as caught. */
const CAUGHT_DISTANCE_M = 3;

/** How strongly speed deviation moves the horde's target position.
 * At 20% under target pace the target distance drops ~40% of comfort
 * (25m -> ~15m): clearly noticed within a few seconds, still recoverable. */
const DISTANCE_GAIN = 2.0;

/** Spring rates (fraction of remaining gap closed per second).
 * Advancing slower than retreating means slacking off gives you ~20s of
 * visible warning before things get dire, while speeding back up feels
 * immediately rewarding. */
const ADVANCE_RATE = 0.09; // horde closing in
const RETREAT_RATE = 0.22; // horde falling back

/** GPS needs a moment to get a stable fix, and the player needs a moment to
 * actually start moving. No chase pressure until warmup ends. */
const WARMUP_S = 20;

/** After being caught: horde resets to comfort distance and holds off. */
const CAUGHT_PAUSE_S = 5;

export type HordeStatus = 'warmup' | 'chasing' | 'caught';

export interface HordeState {
  status: HordeStatus;
  /** Meters between player and the front of the horde. */
  hordeDistanceM: number;
  /** Current self-calibrated target pace, m/s. */
  targetPaceMps: number;
  /** speed / targetPace — <1 means losing ground. Clamped to [0, 2]. */
  speedRatio: number;
  /** Times caught so far this session. */
  caughtCount: number;
}

export class HordeSimulation {
  private readonly basePace: number;
  private targetPace: number;
  private hordeDistance = MAX_DISTANCE_M;
  private status: HordeStatus = 'warmup';
  private caughtCount = 0;
  private elapsed = 0;
  private caughtTimer = 0;

  constructor(activityType: ActivityType) {
    this.basePace = BASE_TARGET_PACE[activityType];
    this.targetPace = this.basePace;
  }

  /** Step the simulation. dt is real seconds since last step (clamp big
   * gaps from app backgrounding); speedMps is the smoothed GPS speed. */
  update(dt: number, speedMps: number): HordeState {
    const step = Math.min(Math.max(dt, 0), 0.25);
    this.elapsed += step;

    if (this.status === 'warmup') {
      if (this.elapsed >= WARMUP_S) {
        this.status = 'chasing';
        this.hordeDistance = MAX_DISTANCE_M;
      }
      return this.snapshot(speedMps);
    }

    if (this.status === 'caught') {
      this.caughtTimer -= step;
      // Ease back out to comfort distance during the pause.
      this.hordeDistance +=
        (COMFORT_DISTANCE_M - this.hordeDistance) * Math.min(RETREAT_RATE * 2 * step, 1);
      if (this.caughtTimer <= 0) {
        this.status = 'chasing';
      }
      return this.snapshot(speedMps);
    }

    // Self-calibrating target pace, clamped around the activity baseline.
    const paceAlpha = Math.min(step / TARGET_PACE_TAU_S, 1);
    this.targetPace += (speedMps - this.targetPace) * paceAlpha;
    this.targetPace = Math.min(
      Math.max(this.targetPace, this.basePace * TARGET_PACE_MIN_RATIO),
      this.basePace * TARGET_PACE_MAX_RATIO
    );

    // Where the horde is trying to be, given current effort.
    const speedRatio = this.targetPace > 0 ? speedMps / this.targetPace : 0;
    const targetDistance = Math.min(
      Math.max(COMFORT_DISTANCE_M * (1 + DISTANCE_GAIN * (speedRatio - 1)), 0),
      MAX_DISTANCE_M
    );

    // Spring-damped approach, asymmetric by direction (spec section 5).
    const gap = targetDistance - this.hordeDistance;
    const rate = gap < 0 ? ADVANCE_RATE : RETREAT_RATE;
    this.hordeDistance += gap * Math.min(rate * step, 1);

    if (this.hordeDistance <= CAUGHT_DISTANCE_M) {
      this.status = 'caught';
      this.caughtTimer = CAUGHT_PAUSE_S;
      this.caughtCount += 1;
    }

    return this.snapshot(speedMps);
  }

  private snapshot(speedMps: number): HordeState {
    const ratio = this.targetPace > 0 ? speedMps / this.targetPace : 0;
    return {
      status: this.status,
      hordeDistanceM: this.hordeDistance,
      targetPaceMps: this.targetPace,
      speedRatio: Math.min(Math.max(ratio, 0), 2),
      caughtCount: this.caughtCount,
    };
  }
}

export const HORDE_TUNING = {
  COMFORT_DISTANCE_M,
  MAX_DISTANCE_M,
  CAUGHT_DISTANCE_M,
  WARMUP_S,
} as const;
