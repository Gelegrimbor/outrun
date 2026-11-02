import { supabase } from './supabase';

export interface LeaderboardEntry {
  is_me: boolean;
  display_name: string;
  best_score: number;
  sessions_count: number;
}

export async function fetchGlobalLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  // get_leaderboard() is SECURITY DEFINER (supabase/sql/004) and already
  // returns rows ranked by best_score, capped server-side at 100.
  const { data, error } = await supabase.rpc('get_leaderboard');
  if (error) throw error;
  return ((data as LeaderboardEntry[] | null) ?? []).slice(0, limit);
}
