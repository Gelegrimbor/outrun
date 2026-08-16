import type { GoalType } from '@/stores/sessionStore';

export const GOAL_TYPE_META: Record<GoalType, { label: string; unit: string; quickPicks: number[] }> = {
  distance: { label: 'Distance', unit: 'km', quickPicks: [1, 3, 5, 10] },
  time: { label: 'Time', unit: 'min', quickPicks: [15, 30, 45, 60] },
  calories: { label: 'Calories', unit: 'kcal', quickPicks: [100, 250, 500, 750] },
};

export const GOAL_TYPES: GoalType[] = ['distance', 'time', 'calories'];

// Canonical units: meters for distance, seconds for time, kcal unchanged.
export function toCanonicalValue(goalType: GoalType, displayValue: number): number {
  switch (goalType) {
    case 'distance':
      return displayValue * 1000;
    case 'time':
      return displayValue * 60;
    case 'calories':
      return displayValue;
  }
}

export function fromCanonicalValue(goalType: GoalType, canonicalValue: number): number {
  switch (goalType) {
    case 'distance':
      return canonicalValue / 1000;
    case 'time':
      return canonicalValue / 60;
    case 'calories':
      return canonicalValue;
  }
}
