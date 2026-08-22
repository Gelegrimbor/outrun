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
build** — it will not work in Expo Go or in any build made before this
change. No new Supabase step.

### What this is (v2 — switched to the platform's Pedometer)

[`lib/pace/StepPaceProvider.ts`](lib/pace/StepPaceProvider.ts) implements
the same `PaceProvider` interface as `GpsPaceProvider` — the live screen
doesn't know or care which one is feeding it.

**This is a rewrite, not a retune.** The original version hand-rolled step
detection from the raw accelerometer (peak-detection with a tunable
threshold). Two tuning rounds against real walks both failed — the second
still only registered ~22m of what should have been several hundred meters
over a 3-minute walk. Digging into why turned up a structural problem, not
just wrong constants: the detector required the signal to fall back near
zero between steps before it would "re-arm" for the next one, and an
in-pocket phone's motion during continuous walking often doesn't cleanly
return to baseline (fabric damping + continuous motion) — so it could catch
the first step and then silently miss everything after. That's a weakness
of the detection *approach*, not something a third threshold guess was
likely to fix.

**v2 uses `expo-sensors`' `Pedometer` API** — Core Motion on iOS,
`TYPE_STEP_COUNTER` on Android — i.e. the platform's own step-counting
algorithm, which Apple/Google have validated against far more data than
hand-tuning here ever could. The tradeoff: `watchStepCount()` only gives a
*cumulative* step count on both platforms (confirmed by reading both native
implementations directly), not a per-step timestamp, so cadence is derived
from the deltas between successive callbacks rather than a continuous
signal — coarser than the old 20Hz accelerometer stream, but backed by a
real algorithm instead of a hand-tuned one. Stride-length-from-height
conversion is unchanged from before.

### ⚠️ Known limitation: Android step callbacks can be unreliable

This isn't a "might be a problem" — it's documented upstream:
[expo#16920](https://github.com/expo/expo/issues/16920) (`watchStepCount`
not firing at all on a Samsung A30), [expo#16605](https://github.com/expo/expo/issues/16605)
(updates not firing correctly), and [expo#19899](https://github.com/expo/expo/issues/19899)
(Pedometer not working at all on Android 9 or below). If step detection
seems stalled on a specific Android device, this is the likely reason, not
a regression in this app's code. iOS's Core Motion implementation doesn't
have the same documented history and is expected to be more consistent.
No workaround attempted here — flagging it as a known limitation is more
honest than pretending a wrapper around a flaky platform API is bulletproof.

### New permissions

- **Android 10+**: `ACTIVITY_RECOGNITION` (added to `app.json`) — a runtime
  prompt the first time step mode is used.
- **iOS**: Motion & Fitness (via the `expo-sensors` config plugin's
  `motionPermission` string, now set in `app.json`) — same prompt style as
  any fitness app's step tracking.

Both are exactly the permission pair any real pedometer app asks for — not
a surprise to a user who picks "Indoor (steps)".

### The debug readout changed shape

Now shows what actually matters for telling "not walking enough" apart from
"the platform's callback is lagging" (a real possibility per the known
issue above, not just a tuning question):

```
N steps · X spm · last update Y.Ys ago
```

If that "last update" number climbs high while you're clearly still
walking, that's the platform's step callback stalling — evidence for the
known Android issue, not something to chase by changing app code.

*Fixed since the first test:* the readout was rendering in default
(near-black) text color with no background against the scene's dark
background — legible only as a faint sliver, not a z-index/layering issue
as it first appeared. It's now in a bordered chip with an explicit visible
color, matching the other HUD elements.

Still visible directly on the HUD in any build (not gated behind a debug flag),
for the same reason as before: testing shouldn't depend on getting the
right build type *and* a live DevTools connection at once.

### Test it

1. Dashboard → **Start Session** → pick **Walk** or **Run** (Cycle doesn't
   offer this — see notes) → a **Pace source** toggle appears:
   **Outdoor (GPS)** or **Indoor (steps)**.
2. Pick **Indoor (steps)** → a hint appears confirming it's estimated, not
   measured → **Continue** through goal setup as normal.
3. **Begin Session** → grant the Motion & Fitness / Activity Recognition
   prompt the first time.
4. On the live screen, an **INDOOR · ESTIMATED PACE** badge should be
   visible near the top, distinct from the plain **GPS** badge.
5. Walk normally — in-pocket or natural arm swing, not held rigid. Watch
   the debug readout: step count should climb roughly in line with your
   actual steps, and "last update" shouldn't grow large while you're
   actively walking.
6. Stand still — speed should decay to 0 within a few seconds rather than
   sticking at its last value.
7. Compare total distance at the end against a known distance if possible
   (a measured route, a treadmill's own readout) — this is an estimate,
   expect real disagreement, not GPS-level accuracy.

### Notes / decisions

- **Not offered for Cycle.** There's no equivalent step signal for
  pedaling — that's the Bluetooth sensor piece coming next in this phase.
- **Running accuracy is weaker than walking.** The stride-length formula is
  a fixed walking-gait approximation; real running strides lengthen with
  pace, which this doesn't model.
- Pause/Resume: pausing removes the step-count subscription and banks the
  distance covered so far; resuming re-subscribes, which both platforms'
  native implementations reset to a fresh cumulative count from — the
  provider adds the new segment's distance on top of what was banked,
  rather than losing pre-pause progress.
- **Foreground-only, same as GPS.** Confirmed directly from `expo-sensors`'
  own source: `watchStepCount`'s doc comment states "Pedometer updates will
  not be delivered while the app is in the background," on both platforms.
  This isn't a gap unique to step mode — `GpsPaceProvider` already has
  background location explicitly disabled in `app.json`
  (`isIosBackgroundLocationEnabled`/`isAndroidBackgroundLocationEnabled:
  false`). Both pace sources need the screen on and the app foregrounded to
  track live. The underlying step-counting hardware itself keeps counting
  regardless of app state though — confirmed on iOS (the native module
  re-queries from the session's original start date on returning to
  foreground, so a brief lock/unlock mid-session produces a catch-up jump
  rather than losing those steps); likely true on Android too (its step
  sensor is also cumulative-since-boot at the hardware level), though that
  one isn't confirmed as directly from the source. Real background/
  screen-off tracking for either pace source would need a foreground
  service + background permissions — that's the same Play Store-prep work
  the build spec already flags as a later phase, not something either
  provider does today.
  *(Update: piece 2 below builds exactly this for Android — and it turned
  out background permissions were NOT needed, see there.)*

## Phase 10 (piece 2) — background / screen-off session tracking (Android)

Adds `expo-task-manager`, `expo-notifications`, and `expo-keep-awake`
(new native modules) plus new manifest permissions, so **this needs a
fresh native build**. No new Supabase step.

### First: why your screen-locked test mostly worked already

You observed 39m tracked vs 44m expected with the screen locked mid-session,
despite Pedometer's documented "no delivery while backgrounded." Three
stacked facts explain it:

1. **Screen-locked is not backgrounded.** Locking the screen leaves OUTRUN
   as the top app — Android's aggressive process controls (cached-app
   freezing, background restrictions) target apps the user has *navigated
   away from*, not the app that was foreground when the screen went off.
   The process and JS runtime keep running, at least for a while.
2. **Android's step counter is hardware-cumulative since boot** (documented
   behavior, and visible in expo-sensors' own Kotlin: it reports the raw
   cumulative sensor value minus the count captured at subscribe time).
   The chip keeps counting regardless of app state; events batch in the
   sensor's hardware FIFO while the CPU naps and flush when it wakes — so
   steps taken while locked arrive as a catch-up jump rather than being
   lost. Distance survived because it derives from that cumulative count;
   elapsed time survived because it's wall-clock.
3. **Walking defeats Doze.** Deep Doze requires the device to be
   *stationary* — a phone in a moving pocket doesn't qualify, so the OS
   never clamped down during the walk.

The ~11% shortfall is consistent with FIFO batching latency (ending the
session before a final flush drops whatever was still buffered) plus
normal step-detection undercounting at gait start/stop. So the doc warning
is about *callback delivery*, not *data loss* — step mode was never as
broken in background as it implied. This meaningfully shrank what this
piece needed to build for step mode.

### What's built

**Android only.** Four cooperating pieces:

1. **GPS mode gets a real foreground service** via expo-location's
   `startLocationUpdatesAsync` + `foregroundService`. Key finding from
   reading expo-location's native source: its own comment states a
   "user-initiated foreground service with notification ... does NOT
   require the background location permission." This is Android's
   documented carve-out — a foreground service with
   `foregroundServiceType="location"`, started while the app is visible,
   keeps location flowing on **while-in-use permission alone**. So
   `isAndroidBackgroundLocationEnabled` **stays false** — the answer to
   "flip the flags only if genuinely needed" is that it is NOT needed.
   Only `isAndroidForegroundServiceEnabled: true` was added (contributes
   the FOREGROUND_SERVICE / FOREGROUND_SERVICE_LOCATION manifest
   permissions). The service also keeps the whole process alive, which
   keeps JS timers, scoring, and goal detection running with the screen
   off. Background-delivered fixes feed into the same GpsPaceProvider
   math as foreground ones, deduped by fix timestamp so double-delivery
   through both channels is harmless.
2. **Step mode gets NO location service** — deliberately. It has no
   location permission to piggyback on (asking for location in *indoor*
   mode would be incoherent), and per the investigation above plus the
   real-world test, the cumulative hardware counter already carries
   screen-off step sessions via catch-up. That's the answer to "confirm
   whether Pedometer mode needs the same treatment": it doesn't — it
   needs a different, smaller mechanism (nothing but the notification
   below).
3. **Both modes get an ongoing stats notification** (`distance · avg pace
   · horde Xm`), updated every ~10s while the process runs. This is a
   *second* notification, separate from the service's own static one —
   because expo-location's native module throws if
   `startLocationUpdatesAsync` is re-called while backgrounded (verified
   in source), re-calling it to refresh the service notification's text
   is a dead end. In step mode (no service), updates can lag while the
   CPU naps between sensor batches, then catch up. On Android 13+ the
   first session start asks for notification permission; denying is
   non-fatal (tracking still works, the shade just stays empty).
4. **Both modes, both platforms: the screen no longer sleeps during a
   session** (`expo-keep-awake`). This alone covers the original
   treadmill-console vision — phone propped up, HUD visible, untouched.

### Design decisions to be aware of (deliberate, revisitable)

- **The chase pauses while you're not looking.** The horde sim steps in
  the render loop, which pauses when the screen is off or the app is
  backgrounded. Tracking (distance/time/score/goal) continues; the horde
  holds position until you look again. Rationale: chasing a player on
  degraded sensor cadence would produce unfair catches, and a jump-scare
  CAUGHT on unlock is exactly the "punishment" the spec says this game
  isn't. The notification's horde distance is therefore last-known, not
  live. Technically exploitable ("lock your screen near a gate") — it's
  cardio, not a competitive-integrity problem.
- **Checkpoints crossed while locked** are detected on the first frame
  after unlock (the detector catches up through all passed gates), so
  their `reached_at` timestamps cluster at unlock time rather than the
  true crossing moment. Cosmetic inaccuracy in the checkpoints table.
- **Pause drops the service and notification entirely** — a paused
  session holds no foreground service, matching "tracking is genuinely
  stopped." Resume restarts both (the app is necessarily foregrounded at
  that moment, which is exactly when Android allows a location-type
  service to start).
- **Swiping the app away kills the service** (`killServiceOnDestroy`) and
  the un-persisted session with it — same as before this change; no
  zombie tracking, no orphaned notification.

### iOS: explicitly out of scope this pass

Everything above is `Platform.OS === 'android'`-gated; iOS behavior is
unchanged (foreground-only GPS; step catch-up via Core Motion's re-query
on foregrounding; keep-awake does work there). iOS background GPS has a
viable path (`UIBackgroundModes: location`, which also works with
while-in-use permission for sessions started in the foreground) but it's
a different mechanism with different App Review implications and its own
testing pass. Follow-up piece, flagged, not started — not silently
half-implemented.

### Play Store notes for Phase 9 (so this isn't a surprise later)

- **Foreground service declaration:** targeting Android 14+, Play Console
  requires declaring each foreground service type used and its
  user-visible purpose. Ours: `location` — "live pace/distance tracking
  during a user-initiated workout session, shown via persistent
  notification." Expect to provide a short demo video of the notification
  appearing when a session starts.
- **NOT background location:** because ACCESS_BACKGROUND_LOCATION is not
  in the manifest, the much heavier "background location access" Play
  policy review (mandatory video + prominent-disclosure requirements)
  does **not** apply. Keep it that way unless a real feature demands it.
- **Data safety form:** Location → collected, precise, app functionality;
  session distance/pace summaries are stored (Supabase) but raw location
  traces are not persisted. Physical activity (ACTIVITY_RECOGNITION /
  step data) → collected, app functionality. Notification permission
  needs no declaration.
- **Privacy policy** must mention: foreground location use during
  sessions including screen-off continuation via foreground service,
  step/motion data for indoor pace estimation, and that sensor data is
  processed on-device with only workout summaries uploaded.

### What needs YOUR device verification vs. what's confident

Confident from implementation + source reading: the permission model (no
background-location flag needed — that's expo-location's own source
comment, not an inference), the fix-dedupe math, pause/resume service
lifecycle, notification-permission degradation, iOS untouched.

Needs real-device testing (cannot be verified from here):

1. **GPS mode, screen off:** outdoor GPS session, lock the screen several
   minutes mid-walk, unlock — distance should have accrued continuously
   (not as a catch-up jump), both notifications present while locked, the
   stats one updating every ~10s.
2. **GPS mode, backgrounded:** same but switch to another app instead of
   locking — the state your earlier lock test did NOT cover; truly
   backgrounded apps are where processes get frozen without a service.
3. **Step mode, screen off:** repeat the 39m/44m walk — expect
   same-or-better catch-up, now with the stats notification visible
   (possibly lagging between sensor batches).
4. **Pause interaction:** pause → lock → unlock → resume — no distance
   during the pause; service/notification vanish on pause, return on
   resume.
5. **Battery sanity:** a 30+ min GPS session with screen off shouldn't
   show alarming battery attribution to OUTRUN.
6. **Swipe-away mid-session:** notification and service should die with
   the app; no orphaned notification.
