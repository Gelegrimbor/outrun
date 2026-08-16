import { create } from 'zustand';

export type ActivityType = 'walk' | 'run' | 'cycle';
export type GoalType = 'distance' | 'time' | 'calories';

interface SessionSetupState {
  activityType: ActivityType | null;
  goalType: GoalType | null;
  // Canonical units regardless of goal type: meters for distance, seconds
  // for time, kcal for calories. Screens convert to/from display units.
  goalValue: number | null;
  setActivityType: (activityType: ActivityType) => void;
  setGoal: (goalType: GoalType, goalValue: number) => void;
  reset: () => void;
}

export const useSessionStore = create<SessionSetupState>((set) => ({
  activityType: null,
  goalType: null,
  goalValue: null,
  setActivityType: (activityType) => set({ activityType }),
  setGoal: (goalType, goalValue) => set({ goalType, goalValue }),
  reset: () => set({ activityType: null, goalType: null, goalValue: null }),
}));
