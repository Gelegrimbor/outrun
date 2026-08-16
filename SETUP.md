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
  (later phases). "Start Session" just shows an alert for now.
- In the Supabase Dashboard → **Table Editor → profiles**, you should see one
  row per onboarded user with the values you entered.

### Notes / what's intentionally deferred (Phase 2)

- No editing UI for the profile yet — that's the Profile/Settings screen (Phase 8/9).
- The build spec's onboarding screen mentions a "fitness goal selector," but the `profiles` table in the data model has no column for it, so it's left out here rather than collecting data nothing stores yet. Worth revisiting if/when a `fitness_goal` column gets added.
- Weight/height are metric only (kg/cm), matching the column names in the spec's data model — no unit toggle yet.
