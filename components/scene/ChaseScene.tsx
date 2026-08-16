import { useMemo, useRef, type MutableRefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, useFrame } from '@react-three/fiber/native';
import * as THREE from 'three';
import { HordeSimulation, type HordeState } from '@/lib/game/hordeLogic';
import type { CheckpointPlan } from '@/lib/game/checkpoints';

// View: the camera faces the player, who runs toward it; the road recedes
// to the horizon behind them and the horde sits on it at its real distance.
// This is the one camera angle where "the horde closes in when you slow
// down" is directly visible, which the spec prioritizes over everything
// else. World units are meters; player at origin; +z runs away from the
// camera toward the horizon/horde.

const CAMERA_POS: [number, number, number] = [0, 3.1, -7];
const FOG_NEAR = 24;
const FOG_FAR = 90;

/** Road features stream past the player toward the horizon at this multiple
 * of real speed — 1:1 GPS walking speed reads as barely moving on screen. */
const SCROLL_EXAGGERATION = 3;

const ZOMBIE_COUNT = 24;
/** How wide the horde spreads across the road. */
const HORDE_SPREAD_X = 7;
const HORDE_SPREAD_Z = 9;

/** Meters of anticipation before a checkpoint gate crosses the player. */
const GATE_APPROACH_SCALE = 0.35;

const COLOR_BG = '#0a0d10';
const COLOR_ROAD = '#14181c';
const COLOR_LANE = '#e2792b';
const COLOR_EDGE = '#6b3a16';
const COLOR_PLAYER = '#e2792b';
const COLOR_PLAYER_HEAD = '#f5f6f7';
const COLOR_ZOMBIE_FAR = new THREE.Color('#4a5a4a');
const COLOR_ZOMBIE_NEAR = new THREE.Color('#8f2c2c');
const COLOR_GATE = '#e2792b';

const DASH_COUNT = 22;
const DASH_LENGTH = 1.6;
const DASH_SPACING = 5;
const ROAD_WIDTH = 10;
const ROAD_LENGTH = 150;

export interface ChaseSceneProps {
  sim: HordeSimulation;
  plan: CheckpointPlan;
  /** Latest smoothed speed (m/s), written by the GPS subscription. */
  speedRef: MutableRefObject<number>;
  /** Latest cumulative distance (m), written by the GPS subscription. */
  distanceRef: MutableRefObject<number>;
  /** Continuously updated with the sim's latest snapshot (no re-renders). */
  hordeStateRef: MutableRefObject<HordeState | null>;
  /** While true, the sim and all scene motion freeze (session paused). */
  pausedRef: MutableRefObject<boolean>;
  /** Called only when status or caughtCount changes. */
  onHordeEvent: (state: HordeState) => void;
  /** Called once per checkpoint crossed, with its 1-based index. */
  onCheckpoint: (index: number) => void;
  /** Dev-only: reports measured render FPS a couple of times per second. */
  onFps?: (fps: number) => void;
}

/** Measures real render-loop throughput from inside the frame loop — the
 * number that distinguishes "tuning feels slow" from "app is dropping
 * frames". Renders nothing. */
function FpsProbe({ onFps }: { onFps: (fps: number) => void }) {
  const framesRef = useRef(0);
  const windowStartRef = useRef(0);

  useFrame(({ clock }) => {
    framesRef.current += 1;
    const now = clock.elapsedTime;
    const windowS = now - windowStartRef.current;
    if (windowS >= 0.5) {
      onFps(framesRef.current / windowS);
      framesRef.current = 0;
      windowStartRef.current = now;
    }
  });

  return null;
}

function Road() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, ROAD_LENGTH / 2 - 20]}>
        <planeGeometry args={[ROAD_WIDTH, ROAD_LENGTH]} />
        <meshBasicMaterial color={COLOR_ROAD} />
      </mesh>
      {/* Solid edge lines */}
      <mesh position={[-ROAD_WIDTH / 2 + 0.3, 0.01, ROAD_LENGTH / 2 - 20]}>
        <boxGeometry args={[0.18, 0.02, ROAD_LENGTH]} />
        <meshBasicMaterial color={COLOR_EDGE} />
      </mesh>
      <mesh position={[ROAD_WIDTH / 2 - 0.3, 0.01, ROAD_LENGTH / 2 - 20]}>
        <boxGeometry args={[0.18, 0.02, ROAD_LENGTH]} />
        <meshBasicMaterial color={COLOR_EDGE} />
      </mesh>
    </group>
  );
}

/** Center lane dashes scrolling past the player — the primary speed cue. */
function LaneDashes({
  speedRef,
  pausedRef,
}: Pick<ChaseSceneProps, 'speedRef' | 'pausedRef'>) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const offsetRef = useRef(0);

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = pausedRef.current ? 0 : Math.min(delta, 0.1);
    const span = DASH_COUNT * DASH_SPACING;
    offsetRef.current =
      (offsetRef.current + speedRef.current * SCROLL_EXAGGERATION * dt) % DASH_SPACING;

    for (let i = 0; i < DASH_COUNT; i++) {
      // Dashes flow from behind the camera toward the horizon, like the
      // road streaming away behind a runner filmed from the front.
      const z = -12 + ((i * DASH_SPACING + offsetRef.current) % span);
      dummy.position.set(0, 0.02, z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, DASH_COUNT]}>
      <boxGeometry args={[0.25, 0.02, DASH_LENGTH]} />
      <meshBasicMaterial color={COLOR_LANE} />
    </instancedMesh>
  );
}

function PlayerPlaceholder({
  speedRef,
  pausedRef,
}: Pick<ChaseSceneProps, 'speedRef' | 'pausedRef'>) {
  const groupRef = useRef<THREE.Group>(null);
  const phaseRef = useRef(0);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    if (pausedRef.current) return;
    // Running bob, frequency tied to speed so standing still looks still.
    phaseRef.current += Math.min(delta, 0.1) * (4 + speedRef.current * 3);
    const bob = Math.abs(Math.sin(phaseRef.current)) * 0.12 * Math.min(speedRef.current, 1.5);
    group.position.y = bob;
  });

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0.75, 0]}>
        <boxGeometry args={[0.55, 1.1, 0.4]} />
        <meshBasicMaterial color={COLOR_PLAYER} />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <sphereGeometry args={[0.24, 12, 10]} />
        <meshBasicMaterial color={COLOR_PLAYER_HEAD} />
      </mesh>
    </group>
  );
}

interface ZombieSeed {
  x: number;
  z: number;
  scale: number;
  phase: number;
}

function Horde({
  sim,
  speedRef,
  hordeStateRef,
  pausedRef,
  onHordeEvent,
}: Pick<ChaseSceneProps, 'sim' | 'speedRef' | 'hordeStateRef' | 'pausedRef' | 'onHordeEvent'>) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lastStatusRef = useRef<string>('');
  const lastCaughtRef = useRef(0);
  const timeRef = useRef(0);

  const seeds = useMemo<ZombieSeed[]>(
    () =>
      Array.from({ length: ZOMBIE_COUNT }, () => ({
        x: (Math.random() - 0.5) * HORDE_SPREAD_X,
        z: Math.random() * HORDE_SPREAD_Z,
        scale: 0.8 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
      })),
    []
  );

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    if (pausedRef.current) return;
    const dt = Math.min(delta, 0.1);
    timeRef.current += dt;

    const state = sim.update(dt, speedRef.current);
    hordeStateRef.current = state;

    if (state.status !== lastStatusRef.current || state.caughtCount !== lastCaughtRef.current) {
      lastStatusRef.current = state.status;
      lastCaughtRef.current = state.caughtCount;
      onHordeEvent(state);
    }

    const frontZ = state.hordeDistanceM;
    for (let i = 0; i < ZOMBIE_COUNT; i++) {
      const seed = seeds[i];
      const shamble = Math.sin(timeRef.current * 2.2 + seed.phase);
      dummy.position.set(
        seed.x + shamble * 0.25,
        seed.scale * 0.85 + Math.abs(shamble) * 0.08,
        frontZ + seed.z
      );
      dummy.scale.setScalar(seed.scale);
      dummy.rotation.set(0, 0, shamble * 0.08);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;

    // Silhouettes flush toward danger-red as the horde closes in.
    if (materialRef.current) {
      const closeness = 1 - Math.min(Math.max((frontZ - 3) / 30, 0), 1);
      materialRef.current.color.lerpColors(COLOR_ZOMBIE_FAR, COLOR_ZOMBIE_NEAR, closeness);
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, ZOMBIE_COUNT]}>
      <coneGeometry args={[0.42, 1.7, 7]} />
      <meshBasicMaterial ref={materialRef} color={COLOR_ZOMBIE_FAR} />
    </instancedMesh>
  );
}

function CheckpointGate({ z }: { z: number }) {
  return (
    <group position={[0, 0, z]}>
      <mesh position={[-ROAD_WIDTH / 2 + 0.8, 1.6, 0]}>
        <boxGeometry args={[0.25, 3.2, 0.25]} />
        <meshBasicMaterial color={COLOR_GATE} />
      </mesh>
      <mesh position={[ROAD_WIDTH / 2 - 0.8, 1.6, 0]}>
        <boxGeometry args={[0.25, 3.2, 0.25]} />
        <meshBasicMaterial color={COLOR_GATE} />
      </mesh>
      <mesh position={[0, 3.2, 0]}>
        <boxGeometry args={[ROAD_WIDTH - 1.35, 0.22, 0.22]} />
        <meshBasicMaterial color={COLOR_GATE} />
      </mesh>
    </group>
  );
}

function Checkpoints({
  plan,
  distanceRef,
  onCheckpoint,
}: Pick<ChaseSceneProps, 'plan' | 'distanceRef' | 'onCheckpoint'>) {
  const currentGateRef = useRef<THREE.Group>(null);
  const passedGateRef = useRef<THREE.Group>(null);
  const nextIndexRef = useRef(0);

  useFrame(() => {
    const covered = distanceRef.current;

    while (
      nextIndexRef.current < plan.distancesM.length &&
      covered >= plan.distancesM[nextIndexRef.current]
    ) {
      nextIndexRef.current += 1;
      onCheckpoint(nextIndexRef.current);
    }

    // Upcoming gate drifts in from behind the camera and crosses the player
    // plane exactly when its distance is reached.
    const current = currentGateRef.current;
    if (current) {
      if (nextIndexRef.current < plan.distancesM.length) {
        const remaining = plan.distancesM[nextIndexRef.current] - covered;
        current.visible = remaining * GATE_APPROACH_SCALE < 60;
        current.position.z = -remaining * GATE_APPROACH_SCALE;
      } else {
        current.visible = false;
      }
    }

    // The most recently passed gate recedes toward the horizon.
    const passed = passedGateRef.current;
    if (passed) {
      if (nextIndexRef.current > 0) {
        const since = covered - plan.distancesM[nextIndexRef.current - 1];
        passed.visible = since * GATE_APPROACH_SCALE < FOG_FAR;
        passed.position.z = since * GATE_APPROACH_SCALE;
      } else {
        passed.visible = false;
      }
    }
  });

  return (
    <>
      <group ref={currentGateRef} visible={false}>
        <CheckpointGate z={0} />
      </group>
      <group ref={passedGateRef} visible={false}>
        <CheckpointGate z={0} />
      </group>
    </>
  );
}

export function ChaseScene(props: ChaseSceneProps) {
  return (
    <View style={styles.container}>
      <Canvas
        camera={{ position: CAMERA_POS, fov: 55, near: 0.1, far: 200 }}
        onCreated={({ scene, camera }) => {
          scene.background = new THREE.Color(COLOR_BG);
          scene.fog = new THREE.Fog(COLOR_BG, FOG_NEAR, FOG_FAR);
          camera.lookAt(0, 1.1, 8);
        }}
      >
        <Road />
        <LaneDashes speedRef={props.speedRef} pausedRef={props.pausedRef} />
        <PlayerPlaceholder speedRef={props.speedRef} pausedRef={props.pausedRef} />
        <Horde
          sim={props.sim}
          speedRef={props.speedRef}
          hordeStateRef={props.hordeStateRef}
          pausedRef={props.pausedRef}
          onHordeEvent={props.onHordeEvent}
        />
        <Checkpoints
          plan={props.plan}
          distanceRef={props.distanceRef}
          onCheckpoint={props.onCheckpoint}
        />
        {props.onFps ? <FpsProbe onFps={props.onFps} /> : null}
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR_BG,
  },
});
