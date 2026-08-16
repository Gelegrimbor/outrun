import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/context/ctx';
import { useProfile } from '@/context/profile';
import { useSessionStore } from '@/stores/sessionStore';
import {
  fetchRecentSessions,
  fetchStreak,
  fetchWeeklyDistanceM,
  type SessionRecord,
  type StreakRecord,
} from '@/lib/sessions';
import { formatDistance, formatDuration } from '@/lib/format';
import { colors, radii, spacing } from '@/constants/theme';

// Weekly target is not yet a user setting (no column for it) — fixed 8km
// until a goals/settings screen exists.
const WEEKLY_GOAL_KM = 8;

const ACTIVITY_LABELS: Record<string, string> = {
  walk: 'Walk',
  run: 'Run',
  cycle: 'Cycle',
};

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
  const [streak, setStreak] = useState<StreakRecord | null>(null);
  const [weeklyM, setWeeklyM] = useState<number | null>(null);
  const [recent, setRecent] = useState<SessionRecord[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let cancelled = false;
      Promise.all([
        fetchStreak(user.id),
        fetchWeeklyDistanceM(user.id),
        fetchRecentSessions(user.id),
      ])
        .then(([streakRow, weekly, sessions]) => {
          if (cancelled) return;
          setStreak(streakRow);
          setWeeklyM(weekly);
          setRecent(sessions);
        })
        .catch((err) => {
          console.warn('Failed to load dashboard data:', err);
        });
      return () => {
        cancelled = true;
      };
    }, [user])
  );

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
  };

  const handleStartSession = () => {
    // Clear any leftover choices from a previous run before entering the
    // flow fresh.
    resetSessionSetup();
    router.push('/session/activity');
  };

  const weeklyKm = (weeklyM ?? 0) / 1000;
  const progressRatio = Math.min(weeklyKm / WEEKLY_GOAL_KM, 1);

  return (
    <Screen>
      <Text style={styles.title}>OUTRUN</Text>
      <Text style={styles.greeting}>
        Welcome back{profile?.display_name ? `, ${profile.display_name}` : ''}
      </Text>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{streak?.current_streak ?? 0}</Text>
          <Text style={styles.statLabel}>Day streak</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>
            {weeklyKm.toFixed(1)}
            <Text style={styles.statValueUnit}> / {WEEKLY_GOAL_KM} km</Text>
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
        {recent === null && <Text style={styles.emptyText}>Loading…</Text>}
        {recent !== null && recent.length === 0 && (
          <Text style={styles.emptyText}>
            No sessions yet — your first walk, run, or ride will show up here.
          </Text>
        )}
        {recent?.map((session) => (
          <View key={session.id} style={styles.sessionRow}>
            <View style={styles.sessionMain}>
              <Text style={styles.sessionActivity}>
                {ACTIVITY_LABELS[session.activity_type] ?? session.activity_type}
              </Text>
              <Text style={styles.sessionMeta}>
                {new Date(session.started_at).toLocaleDateString()} ·{' '}
                {formatDuration(session.duration_s)}
              </Text>
            </View>
            <View style={styles.sessionStats}>
              <Text style={styles.sessionDistance}>{formatDistance(session.distance_m)}</Text>
              <Text style={styles.sessionMeta}>{session.score.toLocaleString()} pts</Text>
            </View>
          </View>
        ))}
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
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  sessionMain: {
    flex: 1,
  },
  sessionActivity: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  sessionMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  sessionStats: {
    alignItems: 'flex-end',
  },
  sessionDistance: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
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
