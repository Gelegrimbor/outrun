-- Run this once in the Supabase Dashboard's SQL Editor (Project -> SQL Editor -> New query).
-- Matches the `profiles` table in the OUTRUN build spec (section 3).

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  weight_kg numeric,
  height_cm numeric,
  age int,
  gender text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
