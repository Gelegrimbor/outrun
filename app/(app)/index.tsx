import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/context/ctx';
import { useProfile } from '@/context/profile';
import { useSessionStore } from '@/stores/sessionStore';
import { colors, radii, spacing } from '@/constants/theme';

// Placeholder numbers -- real streak/goal tracking arrives once sessions
// persist to Supabase (Phase 7).
const PLACEHOLDER_STREAK_DAYS = 3;
const PLACEHOLDER_WEEKLY_GOAL_KM = 8;
const PLACEHOLDER_WEEKLY_PROGRESS_KM = 3.2;

const GENDER_LABELS: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  unspecified: 'Prefer not to say',
};

export default function DashboardScreen() {
  const { user, signOut } = useSession();
  const { profile } = useProfile();
  const resetSessionSetup = useSessionStore((state) => state.reset);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
  };

  const handleStartSession = () => {
    // Clear any leftover choices from a previous run before entering the
    // flow fresh -- Done exits via dismissTo rather than resetting itself,
    // to avoid the flow's own screens reacting to the store going empty
    // out from under them mid-transition.
    resetSessionSetup();
    router.push('/session/activity');
  };

  const progressRatio = Math.min(PLACEHOLDER_WEEKLY_PROGRESS_KM / PLACEHOLDER_WEEKLY_GOAL_KM, 1);

  return (
    <Screen>
      <Text style={styles.title}>OUTRUN</Text>
      <Text style={styles.greeting}>
        Welcome back{profile?.display_name ? `, ${profile.display_name}` : ''}
      </Text>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{PLACEHOLDER_STREAK_DAYS}</Text>
          <Text style={styles.statLabel}>Day streak</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>
            {PLACEHOLDER_WEEKLY_PROGRESS_KM}
            <Text style={styles.statValueUnit}> / {PLACEHOLDER_WEEKLY_GOAL_KM} km</Text>
          </Text>
          <Text style={styles.statLabel}>This week</Text>
        </Card>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
      </View>

      <Button title="Start Session" onPress={handleStartSession} />

      <Card style={styles.firstCardAfterButton}>
        <Text style={styles.cardLabel}>Recent sessions</Text>
        <Text style={styles.emptyText}>
          No sessions yet — your first walk, run, or ride will show up here.
        </Text>
      </Card>

      <Card>
        <Text style={styles.cardLabel}>Your profile</Text>
        <View style={styles.profileRow}>
          <ProfileStat label="Weight" value={profile?.weight_kg ? `${profile.weight_kg} kg` : '—'} />
          <ProfileStat label="Height" value={profile?.height_cm ? `${profile.height_cm} cm` : '—'} />
          <ProfileStat label="Age" value={profile?.age ? String(profile.age) : '—'} />
          <ProfileStat
            label="Gender"
            value={profile?.gender ? GENDER_LABELS[profile.gender] ?? profile.gender : '—'}
          />
        </View>
        <Text style={styles.email}>{user?.email}</Text>
      </Card>

      <Button title="Sign Out" variant="secondary" onPress={handleSignOut} loading={isSigningOut} />
    </Screen>
  );
}

function ProfileStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileStat}>
      <Text style={styles.profileStatValue}>{value}</Text>
      <Text style={styles.profileStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  greeting: {
    color: colors.textSecondary,
    fontSize: 15,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: colors.accent,
    fontSize: 24,
    fontWeight: '800',
  },
  statValueUnit: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  progressTrack: {
    height: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radii.sm,
  },
  firstCardAfterButton: {
    marginTop: spacing.lg,
  },
  cardLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  profileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  profileStat: {
    minWidth: '40%',
  },
  profileStatValue: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  profileStatLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  email: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: spacing.xs,
  },
});
