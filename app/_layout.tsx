import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SessionProvider, useSession } from '@/context/ctx';
import { ProfileProvider, useProfile } from '@/context/profile';

SplashScreen.preventAutoHideAsync().catch(() => {});

function SplashScreenController() {
  const { isLoading: sessionLoading } = useSession();
  const { isLoading: profileLoading } = useProfile();

  useEffect(() => {
    if (!sessionLoading && !profileLoading) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [sessionLoading, profileLoading]);

  return null;
}

function RootNavigator() {
  const { session, isLoading: sessionLoading } = useSession();
  const { profile, isLoading: profileLoading } = useProfile();

  // Once there's a session, wait for the profile lookup to resolve before
  // picking a branch, otherwise a brand-new user would flash into the
  // dashboard before we know they need onboarding.
  const isReady = !sessionLoading && (!session || !profileLoading);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isReady && !!session && !!profile}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      <Stack.Protected guard={isReady && !!session && !profile}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>

      <Stack.Protected guard={isReady && !session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      {/* Unguarded: the OAuth deep link can land here before the session
          finishes propagating into context either way. */}
      <Stack.Screen name="auth/callback" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <ProfileProvider>
        <SplashScreenController />
        <StatusBar style="light" />
        <RootNavigator />
      </ProfileProvider>
    </SessionProvider>
  );
}
