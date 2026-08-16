-- Run once in the Supabase SQL Editor, after 001_profiles.sql and
-- 002_sessions.sql.

-- ── Unlockables ──────────────────────────────────────────────────────────
-- unlock_condition is a small "<metric>:<threshold>" DSL the app evaluates
-- client-side (lib/unlocks.ts) against a user's own aggregate stats, which
-- it can only ever read via the normal RLS-scoped sessions/streaks queries.

create table if not exists unlockables (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  type text check (type in ('character','skin')),
  unlock_condition text not null
);

create table if not exists user_unlockables (
  user_id uuid references profiles(id) on delete cascade,
  unlockable_id uuid references unlockables(id) on delete cascade,
  unlocked_at timestamptz default now(),
  primary key (user_id, unlockable_id)
);

alter table unlockables enable row level security;
alter table user_unlockables enable row level security;

create policy "Unlockables are publicly readable"
  on unlockables for select
  using (true);

create policy "Users manage their own unlocks"
  on user_unlockables for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into unlockables (name, type, unlock_condition) values
  ('Fresh Meat', 'character', 'sessions_completed:1'),
  ('Steady Runner', 'character', 'streak:3'),
  ('Road Warrior', 'character', 'distance_m:10000'),
  ('High Scorer', 'skin', 'best_score:1000'),
  ('Horde Breaker', 'skin', 'zombies_outrun:100')
on conflict (name) do nothing;

-- ── Leaderboard ──────────────────────────────────────────────────────────
-- `sessions` RLS is auth.uid() = user_id (each user sees only their own
-- rows), which is correct for the session-history use case but means a
-- plain query can't build a global leaderboard. This view is intentionally
-- created WITHOUT `security_invoker`, so it runs with the view owner's
-- privileges and can aggregate across all users -- that's the whole point
-- of a leaderboard. To keep that safe, it exposes only what a leaderboard
-- needs (display name, best score, session count) and nothing else
-- (no email, no location data, no raw session rows). Only `authenticated`
-- can read it -- the app requires login anyway.

create or replace view leaderboard as
select
  p.id as user_id,
  coalesce(p.display_name, 'Runner') as display_name,
  max(s.score) as best_score,
  count(s.id) as sessions_count
from profiles p
join sessions s on s.user_id = p.id
group by p.id, p.display_name;

revoke all on leaderboard from anon;
grant select on leaderboard to authenticated;
