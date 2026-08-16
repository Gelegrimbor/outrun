import { supabase } from './supabase';

export interface LeaderboardEntry {
  user_id: string;
  display_name: string;
  best_score: number;
  sessions_count: number;
}

export async function fetchGlobalLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .order('best_score', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
