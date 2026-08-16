import type { ActivityType } from '@/stores/sessionStore';

// MET-based estimate: kcal/min = MET * 3.5 * weight_kg / 200.
// METs picked per activity from rough compendium values; speed-refined
// within a band so a hard run scores higher than a shuffle.

const FALLBACK_WEIGHT_KG = 70;

function metFor(activityType: ActivityType, avgSpeedMps: number): number {
  switch (activityType) {
    case 'walk':
      // ~2.8 (slow stroll) up to ~5 (very brisk)
      return Math.min(Math.max(2 + avgSpeedMps * 1.6, 2.5), 5);
    case 'run':
      // ~7 (light jog) up to ~12.5 (fast run)
      return Math.min(Math.max(2 + avgSpeedMps * 2.4, 7), 12.5);
    case 'cycle':
      // ~5 (easy ride) up to ~10 (hard ride)
      return Math.min(Math.max(2 + avgSpeedMps * 1.2, 5), 10);
  }
}

export function estimateCalories(
  activityType: ActivityType,
  avgSpeedMps: number,
  durationS: number,
  weightKg: number | null
): number {
  const weight = weightKg ?? FALLBACK_WEIGHT_KG;
  const met = metFor(activityType, avgSpeedMps);
  const kcalPerMin = (met * 3.5 * weight) / 200;
  return (durationS / 60) * kcalPerMin;
}
