import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ChaseScene } from '@/components/scene/ChaseScene';
import { useSessionStore, type SessionResult } from '@/stores/sessionStore';
import { useProfile } from '@/context/profile';
import { planCheckpoints } from '@/lib/game/checkpoints';
import { HordeSimulation, HORDE_TUNING, type HordeState } from '@/lib/game/hordeLogic';
import { ScoreKeeper, MAX_HEARTS, type ScoreState } from '@/lib/game/scoring';
import { estimateCalories } from '@/lib/game/calories';
import { formatDistance, formatDuration, formatPaceMinPerKm, formatSpeedKmh } from '@/lib/format';
import { GpsPaceProvider } from '@/lib/pace/GpsPaceProvider';
import { StepPaceProvider } from '@/lib/pace/StepPaceProvider';
import type { PaceProvider, PaceSample } from '@/lib/pace/PaceProvider';
import { colors, radii, spacing } from '@/constants/theme';

const ACTIVITY_LABELS: Record<string, string> = {
  walk: 'Walk',
  run: 'Run',
  cycle: 'Cycle',
};

type Status = 'requesting' | 'denied' | 'tracking' | 'error';

export default function LiveSessionScreen() {
  const { activityType, goalType, goalValue, paceSource, setResult } = useSessionStore();
  const { profile } = useProfile();

  // Picked once at mount from the setup flow's choice -- both implement the
  // same PaceProvider interface, so nothing downstream (scoring, checkpoints,
  // the horde sim) needs to know which one is live.
  const providerRef = useRef<PaceProvider>(
    paceSource === 'step'
      ? new StepPaceProvider(profile?.height_cm ?? null, profile?.gender ?? null)
      : new GpsPaceProvider()
  );
  const scoreKeeperRef = useRef(new ScoreKeeper());
  const speedRef = useRef(0);
  const distanceRef = useRef(0);
  const pausedRef = useRef(false);
  const hordeStateRef = useRef<HordeState | null>(null);
  const lastSampleRef = useRef<PaceSample | null>(null);
  const lastCaughtCountRef = useRef(0);
  const checkpointsReachedRef = useRef<{ distanceM: number; reachedAt: Date }[]>([]);
  const startedAtRef = useRef(new Date());

  const [status, setStatus] = useState<Status>('requesting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sample, setSample] = useState<PaceSample | null>(null);
  const [hordeDistanceM, setHordeDistanceM] = useState<number | null>(null);
  const [hordeStatus, setHordeStatus] = useState<HordeState['status']>('warmup');
  const [caughtCount, setCaughtCount] = useState(0);
  const [checkpointsHit, setCheckpointsHit] = useState(0);
  const [scoreState, setScoreState] = useState<ScoreState>(scoreKeeperRef.current.state);
  const [paused, setPaused] = useState(false);
  const [goalReached, setGoalReached] = useState(false);
  const [fps, setFps] = useState<number | null>(null);

  useEffect(() => {
    if (!activityType || !goalType || goalValue === null) {
      router.replace('/session/activity');
    }
  }, [activityType, goalType, goalValue]);

  const sim = useMemo(() => new HordeSimulation(activityType ?? 'walk'), [activityType]);
  const plan = useMemo(
    () => planCheckpoints(activityType ?? 'walk', goalType ?? 'distance', goalValue ?? 1000),
    [activityType, goalType, goalValue]
  );

  const liveCalories = (s: PaceSample) => {
    const avgSpeed = s.elapsedS > 0 ? s.totalDistanceM / s.elapsedS : 0;
    return estimateCalories(
      activityType ?? 'walk',
      avgSpeed,
      s.elapsedS,
      profile?.weight_kg ?? null
    );
  };

  const beginTracking = async () => {
    setStatus('requesting');
    setErrorMessage(null);
    try {
      await providerRef.current.start();
      startedAtRef.current = new Date();
      setStatus('tracking');
    } catch (err) {
      setStatus(err instanceof Error && err.message.includes('permission') ? 'denied' : 'error');
      setErrorMessage(
        err instanceof Error
          ? err.message
          : `Failed to start ${paceSource === 'step' ? 'the step counter' : 'location tracking'}.`
      );
    }
  };

  useEffect(() => {
    const provider = providerRef.current;
    const unsubscribe = provider.subscribe((s: PaceSample) => {
      speedRef.current = s.speedMps;
      distanceRef.current = s.totalDistanceM;

      // Score accrues at GPS cadence (1Hz) — plenty for points math.
      const prev = lastSampleRef.current;
      const delta = prev ? s.totalDistanceM - prev.totalDistanceM : 0;
      const speedRatio = hordeStateRef.current?.speedRatio ?? 1;
      scoreKeeperRef.current.addDistance(delta, speedRatio);
      lastSampleRef.current = s;

      setSample(s);
      setScoreState(scoreKeeperRef.current.state);
      setHordeDistanceM(hordeStateRef.current?.hordeDistanceM ?? null);

      // Goal progress -> finish-line banner (session keeps going; ending is
      // the player's call).
      const progress =
        goalType === 'distance'
          ? s.totalDistanceM / (goalValue ?? 1)
          : goalType === 'time'
            ? s.elapsedS / (goalValue ?? 1)
            : liveCalories(s) / (goalValue ?? 1);
      if (progress >= 1) setGoalReached(true);
    });
    beginTracking();
    return () => {
      unsubscribe();
      provider.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleHordeEvent = (state: HordeState) => {
    setHordeStatus(state.status);
    setCaughtCount(state.caughtCount);
    if (state.caughtCount > lastCaughtCountRef.current) {
      lastCaughtCountRef.current = state.caughtCount;
      scoreKeeperRef.current.onCaught();
      setScoreState(scoreKeeperRef.current.state);
    }
  };

  const handleCheckpoint = (index: number) => {
    setCheckpointsHit(index);
    checkpointsReachedRef.current.push({
      distanceM: plan.distancesM[index - 1],
      reachedAt: new Date(),
    });
    scoreKeeperRef.current.onCheckpoint();
    setScoreState(scoreKeeperRef.current.state);
  };

  const handlePause = () => {
    pausedRef.current = true;
    providerRef.current.pause();
    setPaused(true);
  };

  const handleResume = async () => {
    await providerRef.current.resume();
    pausedRef.current = false;
    setPaused(false);
  };

  const handleEndSession = () => {
    providerRef.current.stop();
    const s = lastSampleRef.current;
    const distanceM = s?.totalDistanceM ?? 0;
    const durationS = s?.elapsedS ?? 0;
    const avgSpeedMps = durationS > 0 ? distanceM / durationS : 0;
    const score = scoreKeeperRef.current.state;

    const result: SessionResult = {
      activityType: activityType ?? 'walk',
      goalType: goalType ?? 'distance',
      goalValue: goalValue ?? 0,
      distanceM,
      durationS,
      avgSpeedMps,
      calories: s ? liveCalories(s) : 0,
      score: score.score,
      hearts: score.hearts,
      zombiesOutrun: score.zombiesOutrun,
      caughtCount,
      checkpointsHit,
      checkpointsTotal: plan.distancesM.length,
      checkpoints: checkpointsReachedRef.current,
      startedAt: startedAtRef.current,
      endedAt: new Date(),
    };
    setResult(result);
    router.replace('/session/summary');
  };

  if (!activityType || !goalType || goalValue === null) {
    return null;
  }

  if (status !== 'tracking') {
    return (
      <Screen>
        {status === 'requesting' && (
          <Card>
            <Text style={styles.statusText}>
              {paceSource === 'step' ? 'Starting the step counter…' : 'Requesting location access…'}
            </Text>
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
        <Button title="Cancel" variant="secondary" onPress={() => router.dismissTo('/(app)')} />
      </Screen>
    );
  }

  // Checkpoint bar: progress from the previous gate to the next one.
  const covered = sample?.totalDistanceM ?? 0;
  const prevGateM = checkpointsHit > 0 ? plan.distancesM[checkpointsHit - 1] : 0;
  const nextGateM = checkpointsHit < plan.distancesM.length ? plan.distancesM[checkpointsHit] : null;
  const gateProgress =
    nextGateM !== null
      ? Math.min(Math.max((covered - prevGateM) / (nextGateM - prevGateM), 0), 1)
      : 1;

  return (
    <View style={styles.root}>
      <ChaseScene
        sim={sim}
        plan={plan}
        speedRef={speedRef}
        distanceRef={distanceRef}
        hordeStateRef={hordeStateRef}
        pausedRef={pausedRef}
        onHordeEvent={handleHordeEvent}
        onCheckpoint={handleCheckpoint}
        onFps={__DEV__ ? setFps : undefined}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View pointerEvents="none">
          {/* Which pace source is live -- accuracy expectations differ. */}
          <View style={styles.sourceBadgeRow}>
            <View style={[styles.sourceBadge, paceSource === 'step' && styles.sourceBadgeStep]}>
              <Text style={styles.sourceBadgeText}>
                {paceSource === 'step' ? 'INDOOR · ESTIMATED PACE' : 'GPS'}
              </Text>
            </View>
          </View>

          {/* Speed (top-left) and score (top-right), per the spec's HUD. */}
          <View style={styles.hudTopRow}>
            <View style={styles.hudCard}>
              <Text style={styles.hudValueLarge}>
                {sample ? formatSpeedKmh(sample.speedMps) : '--'}
              </Text>
              <Text style={styles.hudLabel}>
                {sample && sample.elapsedS > 0
                  ? `Avg ${formatPaceMinPerKm(sample.totalDistanceM / sample.elapsedS)}`
                  : ACTIVITY_LABELS[activityType]}
              </Text>
            </View>
            <View style={styles.hudCard}>
              <Text style={styles.hudValueLarge}>{scoreState.score.toLocaleString()}</Text>
              <Text style={styles.hudLabel}>Score</Text>
            </View>
          </View>

          {/* Checkpoint progress bar + distance-to-next. */}
          <View style={styles.checkpointCard}>
            <View style={styles.checkpointBarTrack}>
              <View style={[styles.checkpointBarFill, { width: `${gateProgress * 100}%` }]} />
            </View>
            <View style={styles.checkpointLabelRow}>
              <Text style={styles.hudLabel}>
                {nextGateM !== null
                  ? `Next checkpoint in ${formatDistance(Math.max(nextGateM - covered, 0))}`
                  : 'All checkpoints cleared'}
              </Text>
              <Text style={styles.hudLabel}>
                {checkpointsHit}/{plan.distancesM.length}
              </Text>
            </View>
          </View>

          {/* Hearts. */}
          <View style={styles.heartsRow}>
            {Array.from({ length: MAX_HEARTS }, (_, i) => (
              <Text
                key={i}
                style={[styles.heart, i >= scoreState.hearts && styles.heartLost]}
              >
                {'♥'}
              </Text>
            ))}
          </View>
        </View>

        {/* Center banners. */}
        <View pointerEvents="none" style={styles.bannerZone}>
          {hordeStatus === 'warmup' && !paused && (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>GET MOVING</Text>
              <Text style={styles.bannerSub}>
                The horde arrives in {HORDE_TUNING.WARMUP_S} seconds
              </Text>
            </View>
          )}
          {hordeStatus === 'caught' && !paused && (
            <View style={[styles.banner, styles.bannerDanger]}>
              <Text style={styles.bannerText}>CAUGHT!</Text>
              <Text style={styles.bannerSub}>Push forward — they're backing off for now</Text>
            </View>
          )}
          {goalReached && !paused && hordeStatus === 'chasing' && (
            <View style={styles.banner}>
              <Text style={styles.bannerText}>FINISH LINE</Text>
              <Text style={styles.bannerSub}>Goal reached — keep going or end your session</Text>
            </View>
          )}
        </View>

        {/* Bottom: stats, then controls. */}
        <View style={styles.hudBottom} pointerEvents="box-none">
          {__DEV__ && fps !== null && (
            <Text style={[styles.fpsText, fpsStyle(fps)]}>{Math.round(fps)} FPS</Text>
          )}
          <View style={styles.hudRow} pointerEvents="none">
            <View style={styles.hudCard}>
              <Text style={styles.hudValue}>{formatDistance(covered)}</Text>
              <Text style={styles.hudLabel}>Distance</Text>
            </View>
            <View style={styles.hudCard}>
              <Text style={styles.hudValue}>
                {sample ? formatDuration(sample.elapsedS) : '00:00'}
              </Text>
              <Text style={styles.hudLabel}>Elapsed</Text>
            </View>
            <View style={styles.hudCard}>
              <Text style={styles.hudValue}>{sample ? Math.round(liveCalories(sample)) : 0}</Text>
              <Text style={styles.hudLabel}>Calories</Text>
            </View>
            <View style={styles.hudCard}>
              <Text
                style={[
                  styles.hudValue,
                  hordeDistanceM !== null &&
                    hordeDistanceM < HORDE_TUNING.COMFORT_DISTANCE_M * 0.5 &&
                    styles.hudDanger,
                ]}
              >
                {hordeDistanceM !== null ? `${Math.round(hordeDistanceM)}m` : '--'}
              </Text>
              <Text style={styles.hudLabel}>Horde</Text>
            </View>
          </View>
          <View style={styles.controlRow}>
            <Pressable style={styles.controlButton} onPress={paused ? handleResume : handlePause}>
              <Text style={styles.controlButtonText}>{paused ? 'Resume' : 'Pause'}</Text>
            </Pressable>
            <Pressable
              style={[styles.controlButton, styles.endButton]}
              onPress={handleEndSession}
            >
              <Text style={styles.controlButtonText}>End Session</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* Pause overlay. */}
      {paused && (
        <View style={styles.pauseOverlay}>
          <Text style={styles.pauseTitle}>PAUSED</Text>
          <Text style={styles.pauseSub}>
            Tracking is stopped — distance and time won't count until you resume.
          </Text>
        </View>
      )}
    </View>
  );
}

function fpsStyle(fps: number) {
  if (fps >= 55) return styles.fpsGood;
  if (fps >= 45) return styles.fpsOk;
  return styles.fpsBad;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: spacing.sm,
  },
  sourceBadgeRow: {
    alignItems: 'center',
    paddingTop: spacing.xs,
  },
  sourceBadge: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  sourceBadgeStep: {
    borderColor: colors.accent,
  },
  sourceBadgeText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  hudTopRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  hudCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  hudValueLarge: {
    color: colors.accent,
    fontSize: 20,
    fontWeight: '800',
  },
  hudValue: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '800',
  },
  hudDanger: {
    color: colors.danger,
  },
  hudLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  checkpointCard: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.sm,
  },
  checkpointBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  checkpointBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  checkpointLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  heartsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  heart: {
    color: colors.danger,
    fontSize: 20,
  },
  heartLost: {
    color: 'rgba(255,255,255,0.15)',
  },
  bannerZone: {
    alignItems: 'center',
  },
  banner: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  bannerDanger: {
    borderColor: colors.danger,
  },
  bannerText: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  bannerSub: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  hudBottom: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  hudRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  endButton: {
    borderColor: colors.danger,
  },
  controlButtonText: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  fpsText: {
    alignSelf: 'flex-end',
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  fpsGood: {
    color: '#4caf6d',
  },
  fpsOk: {
    color: colors.accent,
  },
  fpsBad: {
    color: colors.danger,
  },
  pauseOverlay: {
    position: 'absolute',
    top: '30%',
    left: spacing.xl,
    right: spacing.xl,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.lg,
    alignItems: 'center',
  },
  pauseTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
  },
  pauseSub: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});
