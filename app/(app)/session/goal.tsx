import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useSessionStore, type GoalType } from '@/stores/sessionStore';
import { GOAL_TYPE_META, GOAL_TYPES, toCanonicalValue } from '@/lib/sessionGoals';
import { colors, radii, spacing } from '@/constants/theme';

export default function GoalSetupScreen() {
  const setGoal = useSessionStore((state) => state.setGoal);
  const [goalType, setGoalType] = useState<GoalType>('distance');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activeGoal = GOAL_TYPE_META[goalType];

  const handleSelectGoalType = (type: GoalType) => {
    setGoalType(type);
    setValue('');
    setError(null);
  };

  const handleContinue = () => {
    const numeric = Number(value);
    if (!value || Number.isNaN(numeric) || numeric <= 0) {
      setError(`Enter a valid ${activeGoal.label.toLowerCase()} target.`);
      return;
    }
    setGoal(goalType, toCanonicalValue(goalType, numeric));
    router.push('/session/start');
  };

  return (
    <Screen>
      <Text style={styles.title}>Set your finish line</Text>
      <Text style={styles.subtitle}>Pick what this session is measured against.</Text>

      <View style={styles.typeRow}>
        {GOAL_TYPES.map((type) => {
          const selected = type === goalType;
          return (
            <Pressable
              key={type}
              onPress={() => handleSelectGoalType(type)}
              style={[styles.typeChip, selected && styles.typeChipSelected]}
            >
              <Text style={[styles.typeChipText, selected && styles.typeChipTextSelected]}>
                {GOAL_TYPE_META[type].label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.quickRow}>
        {activeGoal.quickPicks.map((pick) => {
          const selected = value === String(pick);
          return (
            <Pressable
              key={pick}
              onPress={() => setValue(String(pick))}
              style={[styles.quickChip, selected && styles.quickChipSelected]}
            >
              <Text style={[styles.quickChipText, selected && styles.quickChipTextSelected]}>
                {pick} {activeGoal.unit}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextField
        label={`Custom (${activeGoal.unit})`}
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        placeholder={`e.g. ${activeGoal.quickPicks[1]}`}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title="Continue" onPress={handleContinue} />
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
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  typeChip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm + 2,
  },
  typeChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  typeChipText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  typeChipTextSelected: {
    color: '#151312',
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  quickChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  quickChipText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  quickChipTextSelected: {
    color: '#151312',
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
});
