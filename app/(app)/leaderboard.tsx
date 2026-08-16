import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useSession } from '@/context/ctx';
import { fetchGlobalLeaderboard, type LeaderboardEntry } from '@/lib/leaderboard';
import { colors, radii, spacing } from '@/constants/theme';

type Tab = 'global' | 'friends';

export default function LeaderboardScreen() {
  const { user } = useSession();
  const [tab, setTab] = useState<Tab>('global');
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (tab !== 'global') return;
      let cancelled = false;
      fetchGlobalLeaderboard()
        .then((rows) => {
          if (!cancelled) setEntries(rows);
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load.');
        });
      return () => {
        cancelled = true;
      };
    }, [tab])
  );

  return (
    <Screen>
      <Text style={styles.title}>Leaderboard</Text>

      <View style={styles.tabRow}>
        <Pressable
          onPress={() => setTab('global')}
          style={[styles.tabChip, tab === 'global' && styles.tabChipSelected]}
        >
          <Text style={[styles.tabText, tab === 'global' && styles.tabTextSelected]}>Global</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('friends')}
          style={[styles.tabChip, tab === 'friends' && styles.tabChipSelected]}
        >
          <Text style={[styles.tabText, tab === 'friends' && styles.tabTextSelected]}>Friends</Text>
        </Pressable>
      </View>

      {tab === 'global' && (
        <Card>
          {error && <Text style={styles.emptyText}>{error}</Text>}
          {!error && entries === null && <Text style={styles.emptyText}>Loading…</Text>}
          {!error && entries !== null && entries.length === 0 && (
            <Text style={styles.emptyText}>
              No scores yet — finish a session to be the first on the board.
            </Text>
          )}
          {entries?.map((entry, index) => (
            <View
              key={entry.user_id}
              style={[styles.row, entry.user_id === user?.id && styles.rowSelf]}
            >
              <Text style={styles.rank}>{index + 1}</Text>
              <View style={styles.rowMain}>
                <Text style={styles.rowName}>{entry.display_name}</Text>
                <Text style={styles.rowMeta}>
                  {entry.sessions_count} session{entry.sessions_count === 1 ? '' : 's'}
                </Text>
              </View>
              <Text style={styles.rowScore}>{entry.best_score.toLocaleString()}</Text>
            </View>
          ))}
        </Card>
      )}

      {tab === 'friends' && (
        <Card>
          <Text style={styles.emptyText}>
            There's no way to add friends in the app yet, so this tab has nothing to show. It'll
            come together once a friends system exists (not part of the current build spec's data
            model).
          </Text>
        </Card>
      )}

      <Button title="Back" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tabChip: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm + 2,
  },
  tabChipSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  tabText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  tabTextSelected: {
    color: '#151312',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowSelf: {
    backgroundColor: 'rgba(226,121,43,0.08)',
  },
  rank: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    width: 28,
  },
  rowMain: {
    flex: 1,
  },
  rowName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  rowMeta: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  rowScore: {
    color: colors.accent,
    fontSize: 15,
    fontWeight: '800',
  },
});
