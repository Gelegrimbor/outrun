-- Run once in the Supabase SQL Editor, after 003_leaderboard_and_unlockables.sql.
--
-- Replaces the `leaderboard` view (which ran with the owner's privileges and
-- relied on column-level grants alone) with a SECURITY DEFINER function.
-- Returns four columns (display_name, best_score, sessions_count, is_me) and
-- no user ids. The surface is explicit: a fixed row cap, an empty
-- search_path with fully qualified names, and EXECUTE granted only to
-- `authenticated`.
--
-- `sessions` RLS only lets users read their own rows, so a global ranking
-- must run as the function owner. Nothing else is exposed: no user id, no
-- email, no avatar, no location data, no raw session rows. `is_me` lets the
-- app highlight the caller's own row without knowing anyone's id.

drop view if exists public.leaderboard;

create or replace function public.get_leaderboard()
returns table (
  display_name text,
  best_score integer,
  sessions_count integer,
  is_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(p.display_name, 'Runner'),
    max(s.score)::integer,
    count(s.id)::integer,
    (p.id = auth.uid())
  from public.profiles p
  join public.sessions s on s.user_id = p.id
  group by p.id, p.display_name
  order by max(s.score) desc nulls last
  limit 100;
$$;

revoke all on function public.get_leaderboard() from public;
revoke all on function public.get_leaderboard() from anon;
grant execute on function public.get_leaderboard() to authenticated;
