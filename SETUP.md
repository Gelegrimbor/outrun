# OUTRUN — Phase 1 setup

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

## Notes / what's intentionally deferred

- The dashboard screen is a placeholder — the real profile/streak/session data comes in Phase 2+.
- No `profiles` row is created on sign-up yet; that table and the onboarding flow are Phase 2.
- Native (non-browser) Google Sign-In (`@react-native-google-signin/google-signin`) would give a more native-feeling account picker, but requires a custom dev client / EAS build and per-platform SHA-1/client ID setup. The web-based flow above works in plain Expo Go, which is why Phase 1 uses it — worth revisiting once we're building dev/standalone clients anyway.
