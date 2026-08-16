// Score / hearts / zombies-outrun bookkeeping. Pure TS, stepped from the
// 1Hz GPS sample handler (score doesn't need frame-rate precision) plus
// discrete checkpoint/caught events from the horde sim.

export const MAX_HEARTS = 3;

/** Points per meter covered, before the effort multiplier. */
const POINTS_PER_METER = 1;
/** Effort multiplier bounds (multiplier = speed / target pace, clamped). */
const MULTIPLIER_MIN = 0.5;
const MULTIPLIER_MAX = 2;
const CHECKPOINT_BONUS = 250;
const CAUGHT_PENALTY = 100;

/** Matches ZOMBIE_COUNT in the scene: each checkpoint passed counts as
 * having outrun the whole visible horde once. Placeholder math — revisit
 * when unlockables/leaderboards make this number matter (Phase 8). */
const ZOMBIES_PER_CHECKPOINT = 24;

export interface ScoreState {
  score: number;
  hearts: number;
  zombiesOutrun: number;
}

export class ScoreKeeper {
  private score = 0;
  private hearts = MAX_HEARTS;
  private zombiesOutrun = 0;
  private fractional = 0;

  /** Accrue distance points. speedRatio is speed/targetPace from the sim. */
  addDistance(distanceDeltaM: number, speedRatio: number): void {
    if (distanceDeltaM <= 0) return;
    const multiplier = Math.min(Math.max(speedRatio, MULTIPLIER_MIN), MULTIPLIER_MAX);
    this.fractional += distanceDeltaM * POINTS_PER_METER * multiplier;
    const whole = Math.floor(this.fractional);
    this.score += whole;
    this.fractional -= whole;
  }

  onCheckpoint(): void {
    this.score += CHECKPOINT_BONUS;
    this.zombiesOutrun += ZOMBIES_PER_CHECKPOINT;
    this.hearts = Math.min(this.hearts + 1, MAX_HEARTS);
  }

  onCaught(): void {
    this.score = Math.max(this.score - CAUGHT_PENALTY, 0);
    this.hearts = Math.max(this.hearts - 1, 0);
  }

  get state(): ScoreState {
    return {
      score: this.score,
      hearts: this.hearts,
      zombiesOutrun: this.zombiesOutrun,
    };
  }
}
