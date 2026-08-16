import { useEffect } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { useSession } from '@/context/ctx';
import { colors } from '@/constants/theme';

// Google OAuth redirects here. By the time this mounts, `createSessionFromUrl`
// (triggered by either openAuthSessionAsync's result or the global Linking
// listener in ctx.tsx) has usually already called setSession, so this screen
// just waits for that to land in context and routes accordingly.
export default function AuthCallbackScreen() {
  const { session } = useSession();

  useEffect(() => {
    if (session) {
      router.replace('/(app)');
      return;
    }
    const timeout = setTimeout(() => router.replace('/(auth)'), 4000);
    return () => clearTimeout(timeout);
  }, [session]);

  return (
    <Screen>
      <ActivityIndicator color={colors.accent} />
    </Screen>
  );
}
