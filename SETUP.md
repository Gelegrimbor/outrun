# OUTRUN — Setup

## Phase 1 — auth

Phase 1 gets you: an Expo Router navigation shell, and email/password + Google
sign-in working end to end through Supabase, with a "Remember me" toggle
backed by the device secure store.

## 1. Create a Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and create a new project (Cloud, not self-hosted — see the build spec's reasoning).
2. Once it's provisioned, go to **Project Settings → API**.
3. Copy the **Project URL** and the **anon public** key.

4. In this repo, copy `.env.example` to `.env` and paste them in:

   ```bash
   cp .env.example .env
   ```

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
   ```

   Restart the dev server after editing `.env` — Expo only reads it at startup.

## 2. Turn off email confirmation (optional, for faster testing)

By default Supabase requires users to click a confirmation link before their
first sign-in works. For quick local testing:

- Dashboard → **Authentication → Sign In / Providers → Email** → turn off
  **Confirm email**.

Leave it on if you want to test the real "check your email" flow — the app
already handles that state on the sign-up screen.

## 3. Enable Google sign-in

This app uses Supabase's hosted OAuth flow (a browser popup + deep link back
into the app), so the app itself never needs a Google client ID — only
Supabase does.

1. **Google Cloud Console** → [console.cloud.google.com](https://console.cloud.google.com) → create (or reuse) a project.
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Authorized redirect URI: `https://<your-project-ref>.supabase.co/auth/v1/callback`
     (find the exact value on the Supabase Google provider page in step 3).
3. Copy the generated **Client ID** and **Client Secret**.
4. **Supabase Dashboard → Authentication → Providers → Google**:
   - Enable it.
   - Paste the Client ID and Client Secret.
   - Save.
5. **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs**,
   add both of these (one per line):

   ```
   exp://**
   outrun://**
   ```

   `exp://**` covers testing in Expo Go (dev server URLs change per network).
   `outrun://**` covers a future dev-client/standalone build using the app's
   own `outrun://` scheme (already set in `app.json`).

## 4. Run it

```bash
npm start
```

Then press `a` for Android, `i` for iOS, or scan the QR code with Expo Go.

Test:
- Sign up with email/password → if email confirmation is on, check your inbox, confirm, then sign in.
- Sign in with email/password.
- Toggle "Remember me" off, sign in, force-quit the app, reopen it — you should land back on the sign-in screen.
- Toggle "Remember me" on, sign in, force-quit, reopen — you should land straight on the placeholder dashboard.
- "Continue with Google" → picks a Google account in the in-app browser → redirects back and lands on the dashboard.
- "Sign Out" from the dashboard returns you to sign-in.

## Notes / what's intentionally deferred (Phase 1)

- Native (non-browser) Google Sign-In (`@react-native-google-signin/google-signin`) would give a more native-feeling account picker, but requires a custom dev client / EAS build and per-platform SHA-1/client ID setup. The web-based flow above works in plain Expo Go, which is why Phase 1 uses it — worth revisiting once we're building dev/standalone clients anyway.

## Phase 2 — profile & onboarding

Phase 2 gets you: a `profiles` table, an onboarding form that runs once per
new user (weight, height, age, gender, display name), and a dashboard shell
that reads that data back plus shows placeholder streak/goal/session stats.

### 1. Create the `profiles` table

I don't have direct access to your Supabase database, so this one step is
manual:

1. Supabase Dashboard → your project → **SQL Editor → New query**.
2. Paste the contents of [`supabase/sql/001_profiles.sql`](supabase/sql/001_profiles.sql) and run it.
   It creates the `profiles` table plus row-level security policies scoping
   every row to `auth.uid() = id`.

No other setup needed — the app already points at this table.

### 2. Test it

```bash
npm start
```

- Sign up (or sign in with an account that has no profile yet) → you should
  land on **Set up your profile**, not the dashboard.
- Fill in display name, weight, height, age, and pick a gender option, then
  **Save & Continue** → you should land on the dashboard automatically, with
  your display name in the greeting and your stats in the "Your profile" card.
- Sign out and sign back in with that same account → you should skip
  onboarding entirely and go straight to the dashboard.
- Streak, weekly goal, and recent sessions on the dashboard are hardcoded
  placeholders — that's expected, real tracking arrives once sessions persist
  (later phases).
- In the Supabase Dashboard → **Table Editor → profiles**, you should see one
  row per onboarded user with the values you entered.

### Notes / what's intentionally deferred (Phase 2)

- No editing UI for the profile yet — that's the Profile/Settings screen (Phase 8/9).
- The build spec's onboarding screen mentions a "fitness goal selector," but the `profiles` table in the data model has no column for it, so it's left out here rather than collecting data nothing stores yet. Worth revisiting if/when a `fitness_goal` column gets added.
- Weight/height are metric only (kg/cm), matching the column names in the spec's data model — no unit toggle yet.

## Phase 3 — session setup flow

Phase 3 gets you: activity picker → goal setup → session start, purely state
and navigation (Zustand) — no GPS, no 3D, nothing persisted to Supabase yet.
No setup steps needed.

### Test it

- Dashboard → **Start Session** → pick Walk/Run/Cycle → pick a goal type
  (Distance/Time/Calories) and a value (quick-pick chip or custom) →
  **Continue** → summary screen shows what you picked.
- **Back** at each step should return to the previous step with your choice
  preserved (until you leave the flow or finish it).

## Phase 4 — GPS pace tracking

Phase 4 gets you: a `PaceProvider` abstraction (see `lib/pace/`) with a v1
GPS implementation, wired into a live speed/pace/distance readout screen
after "Begin Session." No setup steps needed — no new Supabase table, no
dashboard config.

### Test it

This one needs a real device outdoors (or at least near a window) — GPS
doesn't work in the iOS/Android simulators or Expo Go on your dev machine's
own indoor wifi-only location, and won't run at all in a web browser.

1. Dashboard → **Start Session** → pick an activity → pick a goal →
   **Begin Session**.
2. Grant location access when prompted (first time only).
3. Walk or run a **known distance** (e.g. a measured block, a track loop,
   anything you can compare against). Watch the Speed/Pace/Distance/Elapsed
   numbers update live.
4. Compare the app's distance reading against your known distance. Some
   drift is normal (consumer GPS is typically ±5-10m), but it should be in
   the right ballpark, not wildly off.
5. **GPS accuracy** on the card shows the device's own reported horizontal
   accuracy (±meters) — if readings look off, check whether this number is
   high (poor fix, e.g. indoors or under heavy tree cover).
6. **End Session** returns to the dashboard.

### Notes / what's intentionally deferred (Phase 4)

- Foreground tracking only — the app must stay open and on-screen. A
  foreground service for screen-off tracking is Play Store prep work
  (Phase 9 in the build spec), not needed to verify GPS accuracy now.
- No accelerometer-based cadence smoothing yet, even though it's listed in
  the spec's tech stack — the spec's actual "v1 implementation" description
  only calls for GPS position smoothing, so that's all this phase built.
  Worth revisiting if GPS-only proves noisy at very low speeds (e.g. brisk
  walk pace) during real-world testing.
- Speed is smoothed over a rolling 3-second window of GPS fixes (distance
  covered / time elapsed), not the raw `coords.speed` field some Android GPS
  chipsets report unreliably.

## Phase 5 — 3D chase scene

Phase 5 gets you: the live session screen is now the game — a night-highway
3D scene (react-three-fiber + expo-gl + three.js) with a receding road, a
placeholder player, a zombie horde whose distance is driven by your real GPS
pace, and checkpoint gates spaced from your session goal. No setup steps
needed.

### What you're looking at

- The camera faces your character (they run toward it), so the road recedes
  to the horizon behind them and **the horde is always visible** on it at its
  actual distance — per the spec, horde visibility beats everything else.
- Everything is deliberately placeholder geometry: amber box/sphere = you,
  cone silhouettes = the horde, amber arch = checkpoint gate. Real low-poly
  models are a later polish pass.
- Horde silhouettes shift from murky green to red as they close in.

### How the chase works (tuning summary)

- First **20 seconds are a warmup** — the horde holds off while GPS settles
  and you get moving.
- The horde sits ~25m back when you hold a purposeful pace (walk ≈4.5 km/h,
  run ≈8.5 km/h, cycle ≈15 km/h). Your target pace **self-calibrates toward
  your own sustained speed** over ~45s, clamped so it never gets trivial or
  impossible.
- Drop below target pace and the horde starts gaining — slowly (~20s of
  visible warning), so GPS jitter doesn't cause false scares. Speed up and
  it falls back noticeably faster, so effort feels immediately rewarded.
- If it fully reaches you (≤3m): **CAUGHT** — a 5-second setback where the
  horde resets to comfort distance, then the chase resumes. Caught count
  shows in the HUD. Never a game over — this is cardio, not punishment.

### Test it (outdoors, real device)

1. Start a session as usual → **Begin Session** → grant location.
2. During warmup, start walking. After 20s the horde appears at max distance.
3. Hold a steady purposeful pace ~1 min → horde should settle around ~25m.
4. Deliberately slow to a dawdle → within ~10-20s the horde should visibly
   gain and the Horde HUD number fall.
5. Speed back up → it should retreat, clearly faster than it advanced.
6. Stop completely (simulate being caught) → CAUGHT banner within ~30-40s,
   horde backs off, chase resumes.
7. Watch for a checkpoint gate sliding in past your character; the
   Checkpoints HUD counter should tick up as you pass each one.
8. **Feel check (the important one):** does the framerate hold up on your
   device, and does the pace→horde relationship feel fair? Note anything
   that feels off (too twitchy, too forgiving, too slow to react) — all the
   tuning constants live in `lib/game/hordeLogic.ts` with comments, so
   they're one-line changes.

### Notes / decisions (Phase 5)

- **No react-native-game-engine**, even though the spec's stack table lists
  it — react-three-fiber's own frame loop (`useFrame`) already provides the
  update loop, and the horde/checkpoint logic lives in plain TS classes
  (`lib/game/`) that don't care who calls them. Adding RNGE would be a second
  loop with no job. Flagged here in case you want it revisited.
- Performance choices: unlit materials only (silhouette look, no lighting
  pass), the whole horde is one instanced draw call, zero allocations inside
  the frame loop. If a device still stutters, the first knobs are zombie
  count and dash count in `components/scene/ChaseScene.tsx`.
- iOS **simulators** are known to crash on expo-gl content — physical device
  only (Android device testing is unaffected).

## Phase 6 — HUD overlay

Phase 6 gets you the spec's full game HUD on the live screen, wired to real
session state. No setup steps needed.

- **Speed/pace** (top-left) and **score** (top-right).
- **Checkpoint progress bar** with distance-to-next (top).
- **Hearts** (3 max): lose one each time the horde catches you, regain one
  per checkpoint passed. Hearts hitting zero doesn't end anything — cardio,
  not punishment.
- **Score**: ~1 point per meter, multiplied by your effort ratio (0.5×–2×
  of target pace); +250 per checkpoint; −100 when caught.
- **Pause/Resume**: pausing freezes the horde, the scene, AND tracking —
  distance and time during a pause don't count (Strava-style). Movement
  while paused is discarded.
- **FINISH LINE banner** when you hit your session goal — the session keeps
  going until you end it.
- **Dev-only FPS counter** (bottom-right, above the stats): green ≥55,
  amber ≥45, red below. This is measured inside the render loop itself, so
  it distinguishes "the tuning is too gentle" (steady 55-60 but the horde
  feels slow) from "the app is dropping frames" (low/unstable number). If
  it's a performance problem, the first knobs are `ZOMBIE_COUNT` and
  `DASH_COUNT` in `components/scene/ChaseScene.tsx`.

## Phase 7 — session persistence + summary

Phase 7 gets you: sessions saved to Supabase with checkpoint detail, a
summary screen with share, streak tracking, and the dashboard showing real
data (streak, weekly distance, recent sessions).

### 1. Create the sessions/checkpoints/streaks tables

One manual step, same as Phase 2:

1. Supabase Dashboard → **SQL Editor → New query**.
2. Paste and run [`supabase/sql/002_sessions.sql`](supabase/sql/002_sessions.sql)
   (requires `001_profiles.sql` from Phase 2 to have been run first).

### 2. Test it

1. Complete a short session (even a 2-minute walk) → **End Session** → the
   summary screen should show distance/duration/avg pace/calories/score/
   zombies outrun, and "Saving session…" then "Saved. Streak: 1 day".
2. **Share** should open the system share sheet with a one-line summary.
3. **Done** returns to the dashboard, which should now show your real
   streak, this week's distance, and the session in Recent sessions.
4. In Supabase → **Table Editor**: one row in `sessions`, one row per
   checkpoint you passed in `checkpoints`, and your `streaks` row.
5. Do a second session the same day → streak stays; tomorrow → streak +1.
6. Calories use your profile weight (MET-based estimate). If you skipped
   onboarding weight, it falls back to 70kg.

### Notes / decisions (Phases 6-7)

- The spec's summary screen mentions "XP gained" — there's no XP system in
  the data model, so the summary shows score instead. Revisit if/when
  unlockables (Phase 8) need an XP economy.
- "Zombies outrun" is currently `24 × checkpoints passed` (the whole visible
  horde per gate) — placeholder math, flagged for Phase 8 when it matters.
- Streak math runs client-side on save (yesterday → +1, same day → keep,
  older → reset to 1). Good enough for v1; a server-side function would be
  needed if it ever affects leaderboards.
- Weekly goal on the dashboard is still a fixed 8km — there's no user
  setting for it yet (Profile/Settings screen, Phase 8/9).
