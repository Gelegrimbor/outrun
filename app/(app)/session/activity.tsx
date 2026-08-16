import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { useSessionStore, type ActivityType } from '@/stores/sessionStore';
import { colors, radii, spacing } from '@/constants/theme';

const ACTIVITIES: { type: ActivityType; label: string; blurb: string; badge: string }[] = [
  { type: 'walk', label: 'Walk', blurb: 'Steady pace, low intensity.', badge: 'W' },
  { type: 'run', label: 'Run', blurb: 'Push your pace, higher stakes.', badge: 'R' },
  { type: 'cycle', label: 'Cycle', blurb: 'Cover more ground, faster horde.', badge: 'C' },
];

export default function ActivityPickerScreen() {
  const setActivityType = useSessionStore((state) => state.setActivityType);

  const handleSelect = (type: ActivityType) => {
    setActivityType(type);
    router.push('/session/goal');
  };

  return (
    <Screen>
      <Text style={styles.title}>Choose your activity</Text>
      <Text style={styles.subtitle}>Character models arrive in a later phase.</Text>

      <View style={styles.list}>
        {ACTIVITIES.map((activity) => (
          <Pressable
            key={activity.type}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => handleSelect(activity.type)}
          >
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activity.badge}</Text>
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardLabel}>{activity.label}</Text>
              <Text style={styles.cardBlurb}>{activity.blurb}</Text>
            </View>
          </Pressable>
        ))}
      </View>

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
    marginBottom: spacing.lg,
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
});
