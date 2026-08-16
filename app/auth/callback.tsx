import { useEffect } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { useSession } from '@/context/ctx';
import { useProfile } from '@/context/profile';
import { colors } from '@/constants/theme';

// Google OAuth redirects here. By the time this mounts, `createSessionFromUrl`
// (triggered by either openAuthSessionAsync's result or the global Linking
// listener in ctx.tsx) has usually already called setSession, so this screen
// just waits for that -- and the resulting profile lookup -- to land in
// context, then routes accordingly.
export default function AuthCallbackScreen() {
  const { session } = useSession();
  const { profile, isLoading: profileLoading } = useProfile();

  useEffect(() => {
    if (!session) {
      const timeout = setTimeout(() => router.replace('/(auth)'), 4000);
      return () => clearTimeout(timeout);
    }
    if (profileLoading) return;
    router.replace(profile ? '/(app)' : '/onboarding');
  }, [session, profile, profileLoading]);

  return (
    <Screen>
      <ActivityIndicator color={colors.accent} />
    </Screen>
  );
}
