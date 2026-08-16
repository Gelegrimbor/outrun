import type { ActivityType, GoalType } from '@/stores/sessionStore';

// Spec section 5: checkpoints roughly every 60-120 seconds of expected
// effort. We aim for ~90s per checkpoint at the activity's baseline pace,
// then round to a whole checkpoint count between 3 and 12.

const EXPECTED_PACE_MPS: Record<ActivityType, number> = {
  walk: 1.25,
  run: 2.35,
  cycle: 4.2,
};

/** Very rough kcal/min burn per activity, only used to size a calorie goal
 * into an expected duration for checkpoint spacing. Real calorie math
 * (weight-based) arrives with session persistence in Phase 7. */
const ROUGH_KCAL_PER_MIN: Record<ActivityType, number> = {
  walk: 4,
  run: 10,
  cycle: 8,
};

const TARGET_SECONDS_PER_CHECKPOINT = 90;
const MIN_CHECKPOINTS = 3;
const MAX_CHECKPOINTS = 12;

export interface CheckpointPlan {
  /** Cumulative distances (meters) at which each checkpoint sits. */
  distancesM: number[];
  /** Total expected session distance in meters the plan was built from. */
  expectedTotalM: number;
}

/** Convert whatever the goal is into an expected total distance in meters. */
export function expectedDistanceM(
  activityType: ActivityType,
  goalType: GoalType,
  goalValue: number
): number {
  const pace = EXPECTED_PACE_MPS[activityType];
  switch (goalType) {
    case 'distance':
      return goalValue;
    case 'time':
      return goalValue * pace;
    case 'calories': {
      const expectedMinutes = goalValue / ROUGH_KCAL_PER_MIN[activityType];
      return expectedMinutes * 60 * pace;
    }
  }
}

export function planCheckpoints(
  activityType: ActivityType,
  goalType: GoalType,
  goalValue: number
): CheckpointPlan {
  const totalM = expectedDistanceM(activityType, goalType, goalValue);
  const pace = EXPECTED_PACE_MPS[activityType];

  const idealSpacingM = pace * TARGET_SECONDS_PER_CHECKPOINT;
  const count = Math.min(
    Math.max(Math.round(totalM / idealSpacingM), MIN_CHECKPOINTS),
    MAX_CHECKPOINTS
  );

  const spacingM = totalM / count;
  const distancesM = Array.from({ length: count }, (_, i) => spacingM * (i + 1));

  return { distancesM, expectedTotalM: totalM };
}
