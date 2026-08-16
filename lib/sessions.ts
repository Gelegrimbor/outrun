import { supabase } from './supabase';
import type { ActivityType, GoalType } from '@/stores/sessionStore';

export interface SessionRecord {
  id: string;
  activity_type: ActivityType;
  goal_type: GoalType;
  goal_value: number;
  distance_m: number;
  duration_s: number;
  avg_pace: number | null;
  calories: number;
  score: number;
  zombies_outrun: number;
  started_at: string;
  ended_at: string;
}

export interface SessionInput {
  activityType: ActivityType;
  goalType: GoalType;
  goalValue: number;
  distanceM: number;
  durationS: number;
  /** Seconds per kilometer; null when too little distance to be meaningful. */
  avgPaceSecPerKm: number | null;
  calories: number;
  score: number;
  zombiesOutrun: number;
  startedAt: Date;
  endedAt: Date;
  /** Cumulative distance + wall-clock time of each checkpoint reached. */
  checkpoints: { distanceM: number; reachedAt: Date }[];
}

export interface StreakRecord {
  current_streak: number;
  longest_streak: number;
  last_session_date: string | null;
}

function localDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function saveSession(userId: string, input: SessionInput): Promise<string> {
  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      user_id: userId,
      activity_type: input.activityType,
      goal_type: input.goalType,
      goal_value: input.goalValue,
      distance_m: input.distanceM,
      duration_s: input.durationS,
      avg_pace: input.avgPaceSecPerKm,
      calories: input.calories,
      score: input.score,
      zombies_outrun: input.zombiesOutrun,
      started_at: input.startedAt.toISOString(),
      ended_at: input.endedAt.toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;

  if (input.checkpoints.length > 0) {
    const { error: cpError } = await supabase.from('checkpoints').insert(
      input.checkpoints.map((cp) => ({
        session_id: session.id,
        distance_m: cp.distanceM,
        reached_at: cp.reachedAt.toISOString(),
      }))
    );
    // Checkpoint rows are nice-to-have detail; the session itself saved.
    if (cpError) console.warn('Failed to save checkpoint rows:', cpError.message);
  }

  return session.id;
}

/** Recompute the user's streak given a session that ended `endedAt`.
 * Same-day sessions keep the streak, consecutive-day extend it, a gap
 * resets it to 1. Returns the updated record. */
export async function updateStreak(userId: string, endedAt: Date): Promise<StreakRecord> {
  const { data: existing, error: fetchError } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const today = localDateString(endedAt);
  const yesterday = localDateString(new Date(endedAt.getTime() - 24 * 60 * 60 * 1000));

  let current = 1;
  if (existing?.last_session_date === today) {
    current = existing.current_streak;
  } else if (existing?.last_session_date === yesterday) {
    current = existing.current_streak + 1;
  }
  const longest = Math.max(current, existing?.longest_streak ?? 0);

  const record = {
    user_id: userId,
    current_streak: current,
    longest_streak: longest,
    last_session_date: today,
  };
  const { error: upsertError } = await supabase.from('streaks').upsert(record);
  if (upsertError) throw upsertError;

  return {
    current_streak: current,
    longest_streak: longest,
    last_session_date: today,
  };
}

export async function fetchStreak(userId: string): Promise<StreakRecord | null> {
  const { data, error } = await supabase
    .from('streaks')
    .select('current_streak, longest_streak, last_session_date')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchRecentSessions(userId: string, limit = 5): Promise<SessionRecord[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select(
      'id, activity_type, goal_type, goal_value, distance_m, duration_s, avg_pace, calories, score, zombies_outrun, started_at, ended_at'
    )
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Total meters covered in sessions that started on/after local Monday. */
export async function fetchWeeklyDistanceM(userId: string): Promise<number> {
  const now = new Date();
  const monday = new Date(now);
  const day = monday.getDay(); // 0 = Sunday
  monday.setDate(monday.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('sessions')
    .select('distance_m')
    .eq('user_id', userId)
    .gte('started_at', monday.toISOString());
  if (error) throw error;
  return (data ?? []).reduce((sum, row) => sum + (row.distance_m ?? 0), 0);
}
