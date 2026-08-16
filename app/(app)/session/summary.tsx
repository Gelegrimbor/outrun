import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/context/ctx';
import { useSessionStore } from '@/stores/sessionStore';
import { saveSession, updateStreak, type StreakRecord } from '@/lib/sessions';
import { formatDistance, formatDuration, formatPaceMinPerKm } from '@/lib/format';
import { colors, spacing } from '@/constants/theme';

const ACTIVITY_LABELS: Record<string, string> = {
  walk: 'Walk',
  run: 'Run',
  cycle: 'Cycle',
};

type SaveState = 'saving' | 'saved' | 'error';

export default function SessionSummaryScreen() {
  const { user } = useSession();
  const { result, reset } = useSessionStore();
  const [saveState, setSaveState] = useState<SaveState>('saving');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [streak, setStreak] = useState<StreakRecord | null>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!result) {
      router.replace('/(app)');
    }
  }, [result]);

  const persist = async () => {
    if (!result || !user || savedRef.current) return;
    setSaveState('saving');
    setSaveError(null);
    try {
      await saveSession(user.id, {
        activityType: result.activityType,
        goalType: result.goalType,
        goalValue: result.goalValue,
        distanceM: result.distanceM,
        durationS: Math.round(result.durationS),
        avgPaceSecPerKm:
          result.avgSpeedMps > 0.2 ? Math.round(1000 / result.avgSpeedMps) : null,
        calories: Math.round(result.calories),
        score: result.score,
        zombiesOutrun: result.zombiesOutrun,
        startedAt: result.startedAt,
        endedAt: result.endedAt,
        checkpoints: result.checkpoints,
      });
      savedRef.current = true;
      const updated = await updateStreak(user.id, result.endedAt);
      setStreak(updated);
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setSaveError(err instanceof Error ? err.message : 'Failed to save session.');
    }
  };

  useEffect(() => {
    persist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!result) return null;

  const handleShare = async () => {
    const parts = [
      `OUTRUN — ${ACTIVITY_LABELS[result.activityType]}`,
      `${formatDistance(result.distanceM)} in ${formatDuration(result.durationS)}`,
      `Score ${result.score.toLocaleString()}`,
      `${result.zombiesOutrun} zombies outrun`,
    ];
    if (result.caughtCount > 0) parts.push(`Caught ${result.caughtCount}x (still alive)`);
    try {
      await Share.share({ message: parts.join(' · ') });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  };

  const handleDone = () => {
    reset();
    router.dismissTo('/(app)');
  };

  return (
    <Screen>
      <Text style={styles.title}>Session complete</Text>
      <Text style={styles.subtitle}>
        {ACTIVITY_LABELS[result.activityType]} ·{' '}
        {result.checkpointsHit}/{result.checkpointsTotal} checkpoints
      </Text>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{formatDistance(result.distanceM)}</Text>
          <Text style={styles.statLabel}>Distance</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{formatDuration(result.durationS)}</Text>
          <Text style={styles.statLabel}>Duration</Text>
        </Card>
      </View>
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{formatPaceMinPerKm(result.avgSpeedMps)}</Text>
          <Text style={styles.statLabel}>Avg pace</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{Math.round(result.calories)}</Text>
          <Text style={styles.statLabel}>Calories</Text>
        </Card>
      </View>
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{result.score.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Score</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{result.zombiesOutrun}</Text>
          <Text style={styles.statLabel}>Zombies outrun</Text>
        </Card>
      </View>

      {result.caughtCount > 0 && (
        <Card>
          <Text style={styles.caughtText}>
            The horde caught you {result.caughtCount}
            {result.caughtCount === 1 ? ' time' : ' times'} — outrun them next time.
          </Text>
        </Card>
      )}

      <Card>
        {saveState === 'saving' && <Text style={styles.saveText}>Saving session…</Text>}
        {saveState === 'saved' && (
          <Text style={styles.saveText}>
            Saved.{' '}
            {streak
              ? `Streak: ${streak.current_streak} day${streak.current_streak === 1 ? '' : 's'}${
                  streak.current_streak >= streak.longest_streak ? ' — personal best!' : ''
                }`
              : ''}
          </Text>
        )}
        {saveState === 'error' && (
          <>
            <Text style={styles.errorText}>
              Couldn't save this session: {saveError}
            </Text>
            <Button title="Retry Save" onPress={persist} />
          </>
        )}
      </Card>

      <Button title="Share" variant="secondary" onPress={handleShare} />
      <Button title="Done" onPress={handleDone} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
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
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  caughtText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  saveText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
});
