import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { getRememberMePreference, setRememberMePreference } from '@/lib/remember-me';

// Lets the in-app auth browser close itself and hand control back to the app
// once Google redirects to our deep link.
WebBrowser.maybeCompleteAuthSession();

type AuthResult = { error: string | null };
type SignUpResult = AuthResult & { needsEmailConfirmation?: boolean };

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  rememberMe: boolean;
  setRememberMe: (value: boolean) => void;
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  signUpWithPassword: (email: string, password: string) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useSession() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return ctx;
}

// In Expo Go this resolves to exp://<lan-ip>:8081/--/auth/callback; in a
// dev-client/standalone build it resolves to outrun://auth/callback (the
// scheme set in app.json). Both patterns are covered by the exp://** and
// outrun://** entries in Supabase's Redirect URLs allow list.
const redirectTo = Linking.createURL('/auth/callback');
if (__DEV__) {
  console.log('[OUTRUN] OAuth redirect URI:', redirectTo);
}

async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return;

  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [rememberMe, setRememberMeState] = useState(true);

  useEffect(() => {
    (async () => {
      const remembered = await getRememberMePreference();
      setRememberMeState(remembered);

      if (!remembered) {
        // A prior session exists only because Remember Me was off and the
        // app process survived until now (e.g. background/foreground). A
        // real cold start should not resurrect it.
        await supabase.auth.signOut();
        setSession(null);
      } else {
        const { data } = await supabase.auth.getSession();
        setSession(data.session);
      }

      setIsLoading(false);
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      createSessionFromUrl(url).catch((err) => {
        console.warn('Failed to complete OAuth sign-in from deep link:', err);
      });
    });
    return () => subscription.remove();
  }, []);

  const setRememberMe = (value: boolean) => {
    setRememberMeState(value);
    setRememberMePreference(value).catch((err) => {
      console.warn('Failed to persist remember-me preference:', err);
    });
  };

  const signInWithPassword = async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUpWithPassword = async (email: string, password: string): Promise<SignUpResult> => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    return { error: null, needsEmailConfirmation: !data.session };
  };

  const signInWithGoogle = async (): Promise<AuthResult> => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error) return { error: error.message };
      if (!data?.url) return { error: 'Supabase did not return a Google auth URL.' };

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success' && result.url) {
        await createSessionFromUrl(result.url);
        return { error: null };
      }
      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { error: null };
      }
      return { error: 'Google sign-in did not complete.' };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Google sign-in failed.' };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
        rememberMe,
        setRememberMe,
        signInWithPassword,
        signUpWithPassword,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
