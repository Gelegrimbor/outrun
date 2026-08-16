-- Run once in the Supabase SQL Editor, after 001_profiles.sql.
-- Creates sessions + checkpoints + streaks from the build spec (section 3),
-- with RLS scoping every row to its owner.
--
-- Unit conventions (matching the app):
--   distance_m  meters
--   duration_s  seconds
--   avg_pace    seconds per kilometer
--   calories    kcal

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  activity_type text check (activity_type in ('walk','run','cycle')),
  goal_type text check (goal_type in ('distance','time','calories')),
  goal_value numeric,
  distance_m numeric,
  duration_s int,
  avg_pace numeric,
  calories numeric,
  score int,
  zombies_outrun int,
  started_at timestamptz,
  ended_at timestamptz
);

create table if not exists checkpoints (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  distance_m numeric,
  reached_at timestamptz
);

create table if not exists streaks (
  user_id uuid primary key references profiles(id) on delete cascade,
  current_streak int default 0,
  longest_streak int default 0,
  last_session_date date
);

alter table sessions enable row level security;
alter table checkpoints enable row level security;
alter table streaks enable row level security;

create policy "Users manage their own sessions"
  on sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users manage their own checkpoints"
  on checkpoints for all
  using (exists (
    select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()
  ));

create policy "Users manage their own streak"
  on streaks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists sessions_user_started_idx
  on sessions (user_id, started_at desc);
create index if not exists checkpoints_session_idx
  on checkpoints (session_id);
