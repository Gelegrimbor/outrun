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
  horde per gate) — placeholder math. It's still saved to the database
  (`sessions.zombies_outrun`), just no longer shown on the summary screen or
  in the share text, since displaying it next to real stats implied it was
  equally meaningful.
- Streak math runs client-side on save (yesterday → +1, same day → keep,
  older → reset to 1). Good enough for v1; a server-side function would be
  needed if it ever affects leaderboards.
- Weekly goal on the dashboard is still a fixed 8km — there's no user
  setting for it yet (Profile/Settings screen, Phase 8/9).
- Live session HUD: "pace" next to the speed reading is now **average**
  pace since session start (steadier, matches Strava/Samsung Health
  convention), while the large speed number stays instantaneous (the horde
  logic still reacts to instantaneous speed). Live calories are now on the
  HUD too, using the same MET formula as the summary screen, updating
  every GPS tick.

## Phase 8 — leaderboard + unlockables

Phase 8 gets you: a global leaderboard (real data), a placeholder Friends
tab (see notes below on why), and character/skin unlocks evaluated after
each session and shown on the dashboard.

### 1. Create the leaderboard + unlockables tables

One more manual step:

1. Supabase Dashboard → **SQL Editor → New query**.
2. Paste and run
   [`supabase/sql/003_leaderboard_and_unlockables.sql`](supabase/sql/003_leaderboard_and_unlockables.sql)
   (requires `001_profiles.sql` and `002_sessions.sql` to already be run).

This seeds 5 unlockables tied to conditions computable from data you
already have: first session, 3-day streak, 10km lifetime distance, 1000+
score in one session, 100+ zombies outrun total.

### 2. Test it

1. Dashboard → **Leaderboard** → **Global** tab should show every user
   who's completed at least one session, ranked by their best single-session
   score, with your own row highlighted.
2. **Friends** tab is intentionally a placeholder — see notes below.
3. Complete a session that satisfies an unlock condition (the easiest is
   "Fresh Meat" — any completed session unlocks it) → the summary screen
   should show a **NEW UNLOCK** card.
4. Dashboard → **Unlocked** card should show it highlighted; other
   not-yet-earned ones show dimmed with a hint of what unlocks them.
5. In Supabase → **Table Editor → user_unlockables**, you should see a row
   per unlock.

### Notes / decisions (Phase 8)

- **No friends system.** The spec's screen list calls for a friends/global
  toggle, but the data model in the spec has no table for friend
  relationships at all — there's no way to define "friends" yet. The
  Friends tab exists (toggle is there, matching the screen spec) but says
  so honestly rather than faking data. Would need a `friendships`/`follows`
  table (not in spec) before this can be real.
- **Leaderboard security model**, worth understanding if you touch the SQL:
  the `sessions` table's RLS only lets each user see their own rows, which
  is correct for session history but can't produce a leaderboard. The
  `leaderboard` view deliberately runs with the view owner's privileges
  (not `security_invoker`) so it can aggregate across everyone — but it
  only exposes display name + best score + session count, nothing
  sensitive, and only to `authenticated` users.
- **Unlocks are evaluated and written client-side**, same trust model as
  the rest of the game's stats in this build (score, distance, etc. are
  all client-computed with no server-side validation). A determined user
  could fake an unlock the same way they could already fake a session's
  distance. Not addressed here — consistent with everything else, and low
  stakes for a v1 single-player fitness app.
- Character/skin unlocks are still just names + type ("character"/"skin")
  with a colored initial badge — no actual art, consistent with every other
  placeholder-first phase in this build.

## Standalone preview build (EAS)

For testing real performance (3D scene, GPS, framerate) without the Metro/
dev-client connection in the loop. This produces an installable APK with a
shareable link — not a Play Store submission.

`app.json` now uses a real package identifier (`com.joshuascott.outrun`, both
iOS and Android) instead of the placeholder `com.outrun.app` from early
phases, and [eas.json](eas.json) has a `preview` profile: `distribution:
"internal"` (install link, no store review) and `android.buildType: "apk"`
(installs directly — `.aab` is App Bundle format, store-submission only).

### 1. Log in to EAS

I can't do this step — it's your Expo account:

```bash
npx eas-cli login
```

### 2. First build (also links the project)

```bash
npx eas-cli build --platform android --profile preview
```

The first run will prompt to create/link an EAS project for OUTRUN if one
doesn't exist yet (writes `extra.eas.projectId` into `app.json` — commit
that once it's added). The build runs on Expo's servers; when it finishes
you'll get a page with a QR code and download link — open it on the Android
device and install directly (you'll need to allow "install from unknown
sources" the first time, since this isn't from the Play Store).

### 3. What to check

- The FPS counter should **not** appear anywhere — it's gated on `__DEV__`,
  which is `false` in this build (confirmed: the dev-only frame-counter
  component doesn't even mount when the prop feeding it is `undefined`, so
  there's no measurement overhead either, not just a hidden readout).
- The app should launch straight into OUTRUN — no dev-client "enter a URL"
  screen, even though `expo-dev-client` is still an installed dependency
  (it only activates when a build profile sets `developmentClient: true`,
  which `preview` doesn't).
- This is the number that actually answers the Phase 5 "is it tuning or
  performance" question — Metro/dev-client overhead is completely out of
  the picture here.

### Notes

- `expo-location`, `expo-gl`, etc. all compile as real native modules in
  this build (unlike Expo Go) — GPS and the 3D scene should both work
  exactly as they will in a Play Store build later.
- Re-run the same `eas build` command any time you want a fresh preview
  build after changes; each run gets its own install link.

## Phase 10 (piece 1) — step counter / indoor pace mode

Adds `expo-sensors` (a new native module), so **this needs a fresh EAS
preview build** — it will not work in Expo Go or in a dev-client build made
before this change. No new Supabase step, no new permission prompts.

### What this is

[`lib/pace/StepPaceProvider.ts`](lib/pace/StepPaceProvider.ts) implements
the same `PaceProvider` interface as `GpsPaceProvider` — that's the point of
the interface from Phase 4: the live screen doesn't know or care which one
is feeding it. It estimates pace by peak-detecting steps from the raw
accelerometer (not `expo-sensors`' `Pedometer` API — see the file's header
comment for why: orientation-agnostic, and it avoids the iOS Motion & Fitness
permission prompt entirely, since raw accelerometer needs none) and
converting step cadence into speed via a standard stride-length-from-height
formula, using your profile height (and gender, for a small factor
adjustment) with a 170cm fallback if unset.

### Retuned after the first real test (still needs your validation)

The first cut only registered shake-level motion, not normal walking. Two
compounding causes, both now fixed in `lib/pace/StepPaceProvider.ts`:

- The step threshold (0.15g) sat at the top of normal walking's actual
  swing range (~0.05-0.15g) — lowered to 0.05g.
- The noise-filtering low-pass was itself the bigger problem: at the
  20Hz sample rate, its cutoff (~1.36Hz) sat *below* normal walking
  cadence (~1.5-2.5Hz), so it was quietly damping the real step signal
  before the threshold check ever saw it. Retuned to a ~3.18Hz cutoff
  (comfortably above walking and brisk jogging, still well below sensor
  noise) — the file's comments show the formula if it needs adjusting again.
- `MIN_STEP_INTERVAL_MS` (300ms, caps cadence at 200 steps/min) was checked
  and isn't the bottleneck — normal walking is well under that ceiling.

Since neither of us can validate the exact right number without a real
walk, there's now a **dev-only live signal readout** on the HUD in step
mode: `signal 0.0Xg / threshold 0.050g · N steps`. Watch that while walking
normally (in-pocket, natural arm swing — not held rigid) to see how your
actual motion compares to the threshold in real time, rather than guessing
and rebuilding again. If it's still not sensitive enough, or now
over-triggers from normal jostling, that readout tells you which direction
and roughly how far to move `STEP_THRESHOLD_G`.

**Faster iteration tip:** since this round of changes is JS-only (no new
native module), you don't strictly need another *preview* build to test
it — a **development** build (`eas build --profile development`, using the
`expo-dev-client` you already have installed) would let you tweak
`STEP_THRESHOLD_G` and reload over Metro in seconds instead of a full cloud
build each time. Worth setting up if this takes more than one or two more
tuning passes; not required if you'd rather just rebuild the preview again.

### Test it

1. Dashboard → **Start Session** → pick **Walk** or **Run** (Cycle doesn't
   offer this — see notes) → a **Pace source** toggle appears:
   **Outdoor (GPS)** or **Indoor (steps)**.
2. Pick **Indoor (steps)** → a hint appears confirming it's estimated, not
   measured → **Continue** through goal setup as normal.
3. **Begin Session** → should start almost immediately (no permission
   prompt — there isn't one for this).
4. On the live screen, an **INDOOR · ESTIMATED PACE** badge should be
   visible near the top, distinct from the plain **GPS** badge you'd see on
   an outdoor session.
5. Prop the phone somewhere it can sense your stride — a treadmill console
   tray is the reference case, but walking with it in a pocket/armband also
   works since detection isn't tied to a fixed axis. Walk/jog in place or on
   a treadmill; Speed/Pace/Distance should respond to your actual cadence
   within a couple of seconds.
6. Stand still — the speed reading should decay to 0 rather than sticking at
   its last value.
7. Compare against the treadmill's own readout if you have one — this is an
   estimate, expect real disagreement (rough target: within 15-20% at a
   steady pace), not GPS-level accuracy.

### Notes / decisions

- **Not offered for Cycle.** There's no equivalent "step" signal for
  pedaling, and building that isn't part of this pass — that's the
  Bluetooth sensor piece coming next in this phase, which reads real
  trainer/bike data instead of estimating from phone motion.
- **Running accuracy is weaker than walking.** The stride-length formula is
  a fixed walking-gait approximation; real running strides lengthen with
  pace, which this doesn't model. Flagged as a known limitation rather than
  adding pace-dependent stride modeling, to keep this pass to "basic
  indoor pace mode" as scoped.
- **No new permissions requested anywhere** — confirmed raw `Accelerometer`
  needs neither Android's `ACTIVITY_RECOGNITION` (that's only for the
  dedicated step-counter/detector hardware sensors, not general
  accelerometer access) nor iOS's `NSMotionUsageDescription` (only required
  for `Pedometer`/`CMSensorRecorder`-based APIs, which this doesn't use).
- Pause/Resume works the same as GPS mode: pausing stops the accelerometer
  listener, and step history from before a pause is discarded on resume so
  it can't inflate post-resume cadence.
