import { create } from 'zustand';

export type ActivityType = 'walk' | 'run' | 'cycle';
export type GoalType = 'distance' | 'time' | 'calories';
/** 'gps' = outdoor (default). 'step' = indoor/treadmill, accelerometer-
 * estimated. Only offered for walk/run -- see the activity picker. */
export type PaceSource = 'gps' | 'step';

/** Everything the summary screen needs to display and persist a finished
 * session. Built by the live screen at End Session. */
export interface SessionResult {
  activityType: ActivityType;
  goalType: GoalType;
  goalValue: number;
  distanceM: number;
  durationS: number;
  avgSpeedMps: number;
  calories: number;
  score: number;
  hearts: number;
  zombiesOutrun: number;
  caughtCount: number;
  checkpointsHit: number;
  checkpointsTotal: number;
  checkpoints: { distanceM: number; reachedAt: Date }[];
  startedAt: Date;
  endedAt: Date;
}

interface SessionSetupState {
  activityType: ActivityType | null;
  goalType: GoalType | null;
  // Canonical units regardless of goal type: meters for distance, seconds
  // for time, kcal for calories. Screens convert to/from display units.
  goalValue: number | null;
  paceSource: PaceSource;
  result: SessionResult | null;
  setActivityType: (activityType: ActivityType) => void;
  setGoal: (goalType: GoalType, goalValue: number) => void;
  setPaceSource: (paceSource: PaceSource) => void;
  setResult: (result: SessionResult) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionSetupState>((set) => ({
  activityType: null,
  goalType: null,
  goalValue: null,
  paceSource: 'gps',
  result: null,
  setActivityType: (activityType) => set({ activityType }),
  setGoal: (goalType, goalValue) => set({ goalType, goalValue }),
  setPaceSource: (paceSource) => set({ paceSource }),
  setResult: (result) => set({ result }),
  reset: () =>
    set({ activityType: null, goalType: null, goalValue: null, paceSource: 'gps', result: null }),
}));
