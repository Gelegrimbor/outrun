import { supabase } from './supabase';

export interface Profile {
  id: string;
  display_name: string | null;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  gender: string | null;
  created_at: string;
}

export interface ProfileInput {
  display_name: string;
  weight_kg: number;
  height_cm: number;
  age: number;
  gender: string;
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createProfile(userId: string, input: ProfileInput): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .insert({ id: userId, ...input })
    .select()
    .single();

  if (error) throw error;
  return data;
}
