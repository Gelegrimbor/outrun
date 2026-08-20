import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { useSessionStore, type ActivityType, type PaceSource } from '@/stores/sessionStore';
import { colors, radii, spacing } from '@/constants/theme';

const ACTIVITIES: { type: ActivityType; label: string; blurb: string; badge: string }[] = [
  { type: 'walk', label: 'Walk', blurb: 'Steady pace, low intensity.', badge: 'W' },
  { type: 'run', label: 'Run', blurb: 'Push your pace, higher stakes.', badge: 'R' },
  { type: 'cycle', label: 'Cycle', blurb: 'Cover more ground, faster horde.', badge: 'C' },
];

// Indoor pace mode needs a walking/running gait for step detection to mean
// anything -- there's no equivalent signal for cycling yet (that's the
// Bluetooth sensor piece, not this one), so it's not offered there.
const INDOOR_CAPABLE: ActivityType[] = ['walk', 'run'];

export default function ActivityPickerScreen() {
  const setActivityType = useSessionStore((state) => state.setActivityType);
  const setPaceSource = useSessionStore((state) => state.setPaceSource);
  const [selected, setSelected] = useState<ActivityType | null>(null);
  const [paceSource, setLocalPaceSource] = useState<PaceSource>('gps');

  const handleSelectActivity = (type: ActivityType) => {
    setSelected(type);
    setLocalPaceSource('gps');
  };

  const handleContinue = () => {
    if (!selected) return;
    setActivityType(selected);
    setPaceSource(INDOOR_CAPABLE.includes(selected) ? paceSource : 'gps');
    router.push('/session/goal');
  };

  return (
    <Screen>
      <Text style={styles.title}>Choose your activity</Text>
      <Text style={styles.subtitle}>Character models arrive in a later phase.</Text>

      <View style={styles.list}>
        {ACTIVITIES.map((activity) => {
          const isSelected = selected === activity.type;
          return (
            <Pressable
              key={activity.type}
              style={({ pressed }) => [
                styles.card,
                isSelected && styles.cardSelected,
                pressed && styles.cardPressed,
              ]}
              onPress={() => handleSelectActivity(activity.type)}
            >
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{activity.badge}</Text>
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardLabel}>{activity.label}</Text>
                <Text style={styles.cardBlurb}>{activity.blurb}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {selected && INDOOR_CAPABLE.includes(selected) && (
        <View style={styles.sourceSection}>
          <Text style={styles.sourceLabel}>Pace source</Text>
          <View style={styles.sourceRow}>
            <Pressable
              onPress={() => setLocalPaceSource('gps')}
              style={[styles.sourceChip, paceSource === 'gps' && styles.sourceChipSelected]}
            >
              <Text
                style={[styles.sourceChipText, paceSource === 'gps' && styles.sourceChipTextSelected]}
              >
                Outdoor (GPS)
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setLocalPaceSource('step')}
              style={[styles.sourceChip, paceSource === 'step' && styles.sourceChipSelected]}
            >
              <Text
                style={[
                  styles.sourceChipText,
                  paceSource === 'step' && styles.sourceChipTextSelected,
                ]}
              >
                Indoor (steps)
              </Text>
            </Pressable>
          </View>
          {paceSource === 'step' && (
            <Text style={styles.sourceHint}>
              Prop your phone somewhere it can sense your stride (e.g. a treadmill console).
              Pace is estimated from step cadence, not measured — less precise than GPS.
            </Text>
          )}
        </View>
      )}

      {selected && <Button title="Continue" onPress={handleContinue} />}
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
  list: {
    marginBottom: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardSelected: {
    borderColor: colors.accent,
  },
  cardPressed: {
    opacity: 0.8,
  },
  badge: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  badgeText: {
    color: '#151312',
    fontSize: 20,
    fontWeight: '800',
  },
  cardText: {
    flex: 1,
  },
  cardLabel: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  cardBlurb: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  sourceSection: {
    marginBottom: spacing.lg,
  },
  sourceLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sourceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sourceChip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm + 2,
  },
  sourceChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  sourceChipText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  sourceChipTextSelected: {
    color: '#151312',
  },
  sourceHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: spacing.sm,
  },
});
