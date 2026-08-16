import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSessionStore } from '@/stores/sessionStore';
import { GOAL_TYPE_META, fromCanonicalValue } from '@/lib/sessionGoals';
import { formatDistance, formatDuration, formatPaceMinPerKm, formatSpeedKmh } from '@/lib/format';
import { GpsPaceProvider } from '@/lib/pace/GpsPaceProvider';
import type { PaceSample } from '@/lib/pace/PaceProvider';
import { colors, spacing } from '@/constants/theme';

const ACTIVITY_LABELS: Record<string, string> = {
  walk: 'Walk',
  run: 'Run',
  cycle: 'Cycle',
};

type Status = 'requesting' | 'denied' | 'tracking' | 'error';

export default function LiveTrackingScreen() {
  const { activityType, goalType, goalValue } = useSessionStore();
  const providerRef = useRef(new GpsPaceProvider());
  const [status, setStatus] = useState<Status>('requesting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sample, setSample] = useState<PaceSample | null>(null);

  useEffect(() => {
    if (!activityType || !goalType || goalValue === null) {
      router.replace('/session/activity');
    }
  }, [activityType, goalType, goalValue]);

  const beginTracking = async () => {
    setStatus('requesting');
    setErrorMessage(null);
    try {
      await providerRef.current.start();
      setStatus('tracking');
    } catch (err) {
      setStatus(err instanceof Error && err.message.includes('permission') ? 'denied' : 'error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to start location tracking.');
    }
  };

  useEffect(() => {
    const provider = providerRef.current;
    const unsubscribe = provider.subscribe(setSample);
    beginTracking();
    return () => {
      unsubscribe();
      provider.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEndSession = () => {
    providerRef.current.stop();
    router.dismissTo('/(app)');
  };

  if (!activityType || !goalType || goalValue === null) {
    return null;
  }

  const goalMeta = GOAL_TYPE_META[goalType];
  const targetDisplay = fromCanonicalValue(goalType, goalValue);

  return (
    <Screen>
      <Text style={styles.title}>{ACTIVITY_LABELS[activityType]} in progress</Text>
      <Text style={styles.subtitle}>
        Verifying GPS accuracy -- no 3D scene or horde yet, that's a later phase.
      </Text>

      {status === 'requesting' && (
        <Card>
          <Text style={styles.statusText}>Requesting location access…</Text>
        </Card>
      )}

      {status === 'denied' && (
        <Card>
          <Text style={styles.statusText}>
            OUTRUN needs location access to track pace and distance. Grant it in your
            device settings, or try again below.
          </Text>
          <Button title="Try Again" onPress={beginTracking} />
        </Card>
      )}

      {status === 'error' && (
        <Card>
          <Text style={styles.statusText}>{errorMessage ?? 'Something went wrong.'}</Text>
          <Button title="Try Again" onPress={beginTracking} />
        </Card>
      )}

      {status === 'tracking' && (
        <>
          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>
                {sample ? formatSpeedKmh(sample.speedMps) : '--'}
              </Text>
              <Text style={styles.statLabel}>Speed</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>
                {sample ? formatPaceMinPerKm(sample.speedMps) : '--:--'}
              </Text>
              <Text style={styles.statLabel}>Pace</Text>
            </Card>
          </View>

          <View style={styles.statsRow}>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>
                {sample ? formatDistance(sample.totalDistanceM) : '0 m'}
              </Text>
              <Text style={styles.statLabel}>Distance</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={styles.statValue}>
                {sample ? formatDuration(sample.elapsedS) : '00:00'}
              </Text>
              <Text style={styles.statLabel}>Elapsed</Text>
            </Card>
          </View>

          <Card>
            <View style={styles.row}>
              <Text style={styles.label}>Goal</Text>
              <Text style={styles.value}>
                {targetDisplay % 1 === 0 ? targetDisplay : targetDisplay.toFixed(1)}{' '}
                {goalMeta.unit} {goalMeta.label.toLowerCase()}
              </Text>
            </View>
            {goalType !== 'calories' && sample && (
              <View style={styles.row}>
                <Text style={styles.label}>Progress</Text>
                <Text style={styles.value}>
                  {goalType === 'distance'
                    ? formatDistance(sample.totalDistanceM)
                    : formatDuration(sample.elapsedS)}
                </Text>
              </View>
            )}
            <View style={styles.row}>
              <Text style={styles.label}>GPS accuracy</Text>
              <Text style={styles.value}>
                {sample?.accuracyM != null ? `±${Math.round(sample.accuracyM)} m` : 'Unknown'}
              </Text>
            </View>
          </Card>
        </>
      )}

      <Button title="End Session" variant="secondary" onPress={handleEndSession} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: spacing.sm,
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
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  value: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
});
