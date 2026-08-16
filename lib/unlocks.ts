import { supabase } from './supabase';
import { fetchStreak } from './sessions';

export interface Unlockable {
  id: string;
  name: string;
  type: 'character' | 'skin';
  unlock_condition: string;
}

interface UserStats {
  sessionsCompleted: number;
  distanceM: number;
  bestScore: number;
  zombiesOutrun: number;
  longestStreak: number;
}

async function fetchUserStats(userId: string): Promise<UserStats> {
  const [{ data: rows, error }, streak] = await Promise.all([
    supabase.from('sessions').select('distance_m, score, zombies_outrun').eq('user_id', userId),
    fetchStreak(userId),
  ]);
  if (error) throw error;

  const sessions = rows ?? [];
  return {
    sessionsCompleted: sessions.length,
    distanceM: sessions.reduce((sum, r) => sum + (r.distance_m ?? 0), 0),
    bestScore: sessions.reduce((max, r) => Math.max(max, r.score ?? 0), 0),
    zombiesOutrun: sessions.reduce((sum, r) => sum + (r.zombies_outrun ?? 0), 0),
    // Longest, not current: an unlock earned once should stay earned even
    // after the current streak later breaks.
    longestStreak: streak?.longest_streak ?? 0,
  };
}

function meetsCondition(condition: string, stats: UserStats): boolean {
  const [metric, thresholdStr] = condition.split(':');
  const threshold = Number(thresholdStr);
  switch (metric) {
    case 'sessions_completed':
      return stats.sessionsCompleted >= threshold;
    case 'streak':
      return stats.longestStreak >= threshold;
    case 'distance_m':
      return stats.distanceM >= threshold;
    case 'best_score':
      return stats.bestScore >= threshold;
    case 'zombies_outrun':
      return stats.zombiesOutrun >= threshold;
    default:
      return false;
  }
}

/** Human-readable hint for a locked unlockable's condition. */
export function describeCondition(condition: string): string {
  const [metric, thresholdStr] = condition.split(':');
  const threshold = Number(thresholdStr);
  switch (metric) {
    case 'sessions_completed':
      return `Complete ${threshold} session${threshold === 1 ? '' : 's'}`;
    case 'streak':
      return `Reach a ${threshold}-day streak`;
    case 'distance_m':
      return `Cover ${(threshold / 1000).toFixed(0)}km lifetime`;
    case 'best_score':
      return `Score ${threshold.toLocaleString()}+ in one session`;
    case 'zombies_outrun':
      return `Outrun ${threshold.toLocaleString()}+ zombies total`;
    default:
      return 'Unknown condition';
  }
}

export async function fetchAllUnlockables(): Promise<Unlockable[]> {
  const { data, error } = await supabase.from('unlockables').select('*').order('name');
  if (error) throw error;
  return data ?? [];
}

export async function fetchUnlockedIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_unlockables')
    .select('unlockable_id')
    .eq('user_id', userId);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.unlockable_id));
}

/** Evaluate every unlockable against the user's current stats and insert
 * any newly-earned ones. Returns just the ones newly unlocked this call. */
export async function evaluateUnlocks(userId: string): Promise<Unlockable[]> {
  const [all, unlockedIds, stats] = await Promise.all([
    fetchAllUnlockables(),
    fetchUnlockedIds(userId),
    fetchUserStats(userId),
  ]);

  const newlyUnlocked = all.filter(
    (u) => !unlockedIds.has(u.id) && meetsCondition(u.unlock_condition, stats)
  );

  if (newlyUnlocked.length > 0) {
    const { error } = await supabase
      .from('user_unlockables')
      .insert(newlyUnlocked.map((u) => ({ user_id: userId, unlockable_id: u.id })));
    if (error) throw error;
  }

  return newlyUnlocked;
}
