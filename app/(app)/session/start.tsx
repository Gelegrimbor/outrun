import { useEffect } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSessionStore } from '@/stores/sessionStore';
import { GOAL_TYPE_META, fromCanonicalValue } from '@/lib/sessionGoals';
import { colors, spacing } from '@/constants/theme';

const ACTIVITY_LABELS: Record<string, string> = {
  walk: 'Walk',
  run: 'Run',
  cycle: 'Cycle',
};

export default function SessionStartScreen() {
  const { activityType, goalType, goalValue } = useSessionStore();

  // Guard against landing here directly (e.g. deep link, fast-refresh) with
  // no activity/goal chosen yet.
  useEffect(() => {
    if (!activityType || !goalType || goalValue === null) {
      router.replace('/session/activity');
    }
  }, [activityType, goalType, goalValue]);

  if (!activityType || !goalType || goalValue === null) {
    return null;
  }

  const goalMeta = GOAL_TYPE_META[goalType];
  const displayValue = fromCanonicalValue(goalType, goalValue);

  const handleDone = () => {
    // Dismisses activity + goal in one action and lands on the existing
    // dashboard entry, rather than replace() which would leave a second
    // dashboard entry stacked on top of them.
    router.dismissTo('/(app)');
  };

  return (
    <Screen>
      <Text style={styles.title}>You're set</Text>
      <Text style={styles.subtitle}>
        Live GPS tracking and the chase itself arrive in a later phase — this
        just confirms the setup flow works end to end.
      </Text>

      <Card>
        <View style={styles.row}>
          <Text style={styles.label}>Activity</Text>
          <Text style={styles.value}>{ACTIVITY_LABELS[activityType]}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Goal</Text>
          <Text style={styles.value}>
            {displayValue % 1 === 0 ? displayValue : displayValue.toFixed(1)} {goalMeta.unit}{' '}
            {goalMeta.label.toLowerCase()}
          </Text>
        </View>
      </Card>

      <Button title="Done" onPress={handleDone} />
      <Button title="Back" variant="secondary" onPress={() => router.back()} />
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
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
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
