# OUTRUN

A fitness app that turns your walk, run or ride into a zombie chase. Your real-world pace drives a 3D scene: keep moving and you stay ahead of the horde, slow down and it closes in.

<!-- TODO: add screenshot(s) here, e.g. ![Live session](docs/screenshot-live.png) -->

## Features

- **Auth:** email/password and Google sign-in through Supabase, with a "Remember me" toggle backed by the device secure store.
- **Profile onboarding:** display name, weight, height, age and gender (used for calorie estimates).
- **Session setup:** choose an activity (walk / run / cycle) and a goal (distance / time / calories).
- **Pace tracking:** GPS-based outdoors, or an accelerometer/pedometer step counter for indoor sessions.
- **Live chase:** a 3D scene (three.js via react-three-fiber) with a HUD showing pace, distance, time and calories.
- **Scoring and checkpoints:** score and zombies outrun per session, with a summary screen.
- **History, streaks and leaderboard:** sessions persisted in Supabase; a leaderboard of best scores.
- **Unlockables:** characters and skins unlocked by stats such as sessions completed, streak, distance and score.
- **Android background tracking:** foreground-service GPS so a session continues with the screen off, plus keep-awake.

## Tech stack

- Expo SDK 57, React Native 0.86, React 19, TypeScript
- expo-router (file-based routing, typed routes)
- Supabase (auth, Postgres with Row Level Security)
- zustand for session state
- three, @react-three/fiber, expo-gl for the 3D scene
- expo-location, expo-task-manager, expo-sensors, expo-notifications, expo-keep-awake

## Getting started

### 1. Install

```bash
npm install
```

### 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL Editor, run the files in `supabase/sql/` in order (`001_profiles.sql`, `002_sessions.sql`, `003_leaderboard_and_unlockables.sql`, `004_leaderboard_function.sql`).
3. For Google sign-in, follow the steps in [SETUP.md](SETUP.md).

### 3. Environment variables

```bash
cp .env.example .env
```

Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (Supabase Dashboard, Project Settings, API). Only the public anon key belongs here; never put a `service_role` key in the app. Restart the dev server after editing `.env`.

### 4. Run

```bash
npx expo start
```

Open it in Expo Go on a device. Background tracking and some native behaviour may need a development build instead (`npx expo run:android`, or an EAS build; see [SETUP.md](SETUP.md)).

## Project structure

```
app/            expo-router screens: (auth), (app) with the session flow, onboarding, auth callback
components/     scene/ (3D chase) and ui/ (Button, Card, Screen, TextField)
context/        auth session and profile providers
lib/            supabase client, sessions, leaderboard, unlocks, formatting
lib/game/       scoring, calories, checkpoints, horde logic
lib/pace/       PaceProvider interface with GPS and step-count implementations
lib/session/    Android background tracking
stores/         zustand session store
supabase/sql/   database schema and RLS policies
```

`SETUP.md` is a phase-by-phase build log with setup steps and design notes.

## Known limitations

- Background/screen-off tracking is Android only; iOS is out of scope for now.
- Android step-counter callbacks can be unreliable on some devices; see [SETUP.md](SETUP.md).
- GPS accuracy indoors is poor; fixes worse than 30 m or implying more than 15 m/s are discarded, so use indoor (steps) mode inside.
- Tested on a limited set of real devices; expect rough edges.
- No automated tests are included.
