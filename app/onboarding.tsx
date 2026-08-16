import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useProfile } from '@/context/profile';
import { colors, radii, spacing } from '@/constants/theme';

const GENDER_OPTIONS: { label: string; value: string }[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'unspecified' },
];

export default function OnboardingScreen() {
  const { completeOnboarding } = useProfile();
  const [displayName, setDisplayName] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    if (!displayName.trim()) {
      setError('Tell us what to call you.');
      return;
    }
    const weight = Number(weightKg);
    const height = Number(heightCm);
    const ageNum = Number(age);
    if (!weightKg || Number.isNaN(weight) || weight <= 0) {
      setError('Enter a valid weight in kg.');
      return;
    }
    if (!heightCm || Number.isNaN(height) || height <= 0) {
      setError('Enter a valid height in cm.');
      return;
    }
    if (!age || Number.isNaN(ageNum) || ageNum <= 0) {
      setError('Enter a valid age.');
      return;
    }
    if (!gender) {
      setError('Pick an option so we know how to calculate calories.');
      return;
    }

    setIsSubmitting(true);
    const { error: submitError } = await completeOnboarding({
      display_name: displayName.trim(),
      weight_kg: weight,
      height_cm: height,
      age: ageNum,
      gender,
    });
    setIsSubmitting(false);

    if (submitError) setError(submitError);
    // On success, the root navigator swaps to the dashboard automatically
    // once `profile` updates -- no explicit navigation needed here.
  };

  return (
    <Screen>
      <Text style={styles.title}>Set up your profile</Text>
      <Text style={styles.tagline}>
        This tunes pace targets and calorie estimates to you.
      </Text>

      <View style={styles.form}>
        <TextField
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Runner"
          autoCapitalize="words"
        />
        <TextField
          label="Weight (kg)"
          value={weightKg}
          onChangeText={setWeightKg}
          placeholder="70"
          keyboardType="decimal-pad"
        />
        <TextField
          label="Height (cm)"
          value={heightCm}
          onChangeText={setHeightCm}
          placeholder="175"
          keyboardType="decimal-pad"
        />
        <TextField
          label="Age"
          value={age}
          onChangeText={setAge}
          placeholder="30"
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Gender</Text>
        <View style={styles.chipRow}>
          {GENDER_OPTIONS.map((option) => {
            const selected = gender === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setGender(option.value)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Button title="Save & Continue" onPress={handleSubmit} loading={isSubmitting} />
      </View>
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
  tagline: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  form: {
    marginTop: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  chipText: {
    color: colors.textPrimary,
    fontSize: 14,
  },
  chipTextSelected: {
    color: '#151312',
    fontWeight: '700',
  },
  error: {
    color: colors.danger,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
});
