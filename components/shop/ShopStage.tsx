"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Grid, Lightformer } from "@react-three/drei";
import { useReducedMotion, type MotionValue } from "motion/react";
import { getMotionPaused, useMotionPaused } from "@/lib/motion-pause";
import { clamp, easeInOutCubic, lerp, seg } from "@/lib/timing";
import { COLORS, H, L, RUN_Y, W, type V3 } from "./parts";
import { DuctRun, ELBOW_C, PIVOT, SD } from "./DuctRun";
import { AT, shop } from "./sequence";

/**
 * The shop sequence's own WebGL canvas (client-only; Shop.tsx loads it through
 * next/dynamic with ssr: false). The canvas itself is created only once the section
 * is a screen and a half away. It draws on demand — when the scroll moves the model,
 * and every frame only while the finished run spins — and never off screen or in a
 * hidden tab. Under reduced motion it draws the finished run once.
 */

type Key = { p: number; at: V3; az: number; el: number; r: number };

/**
 * Camera keyframes in scroll progress: the point looked at, azimuth from +z toward
 * +x and elevation (degrees), and the radius (m) that must stay in frame. Between
 * keys the camera eases; the radius blends in log space so zooms feel even.
 */
const KEYS: Key[] = [
  { p: 0, at: [0, RUN_Y, -0.58], az: 22, el: 52, r: 1.08 },
  { p: 0.11, at: [0, RUN_Y, -0.58], az: 30, el: 44, r: 1.02 },
  { p: 0.2, at: [0, RUN_Y + 0.42, -0.42], az: 40, el: 24, r: 1.05 },
  { p: 0.285, at: [0, RUN_Y + 0.18, -0.05], az: 36, el: 24, r: 0.8 },
  { p: 0.34, at: [0.2, RUN_Y + 0.01, W / 2], az: 28, el: 16, r: 0.22 },
  { p: 0.41, at: [0.14, RUN_Y + 0.02, W / 2], az: 36, el: 20, r: 0.25 },
  { p: 0.5, at: [L / 2, RUN_Y + H / 2, 0.03], az: 62, el: 20, r: 0.5 },
  { p: 0.555, at: [L / 2, RUN_Y + H / 2, 0.03], az: 56, el: 22, r: 0.55 },
  { p: 0.635, at: [0.66, RUN_Y + 0.17, 0.3], az: 24, el: 24, r: 1.15 },
  { p: 0.7, at: [SD[0], RUN_Y + 0.1, SD[2]], az: 32, el: 22, r: 0.42 },
  { p: 0.73, at: [SD[0], RUN_Y + 0.1, SD[2]], az: 34, el: 22, r: 0.44 },
  { p: 0.81, at: ELBOW_C, az: 24, el: 54, r: 0.68 },
  { p: 0.86, at: ELBOW_C, az: 32, el: 48, r: 0.7 },
  { p: 0.95, at: [PIVOT[0], RUN_Y + 0.12, PIVOT[1]], az: 32, el: 28, r: 1.72 },
  { p: 1, at: [PIVOT[0], RUN_Y + 0.12, PIVOT[1]], az: 34, el: 28, r: 1.72 },
];

const DEG = Math.PI / 180;
/** < 1 tightens the fit: a bounding sphere over-frames these long, flat parts. */
const FIT = 0.92;
/** Drawing-buffer budget for a viewport-sized canvas (device pixels): big, dense screens get a lower DPR, never below 1. */
const PIXEL_BUDGET = 2.5e6;
const MAX_DPR = 1.75;
/** Longest step the spin's clock takes after a gap between frames (s). */
const MAX_DT = 0.1;

function pose(cam: THREE.PerspectiveCamera, p: number, aspect: number) {
  let i = 0;
  while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];
  const k = easeInOutCubic(seg(p, a.p, b.p));
  const tx = lerp(a.at[0], b.at[0], k);
  const ty = lerp(a.at[1], b.at[1], k);
  const tz = lerp(a.at[2], b.at[2], k);
  const az = lerp(a.az, b.az, k) * DEG;
  const el = lerp(a.el, b.el, k) * DEG;
  const r = Math.exp(lerp(Math.log(a.r), Math.log(b.r), k));
  const v = cam.fov * DEG;
  const half = Math.min(v, 2 * Math.atan(Math.tan(v / 2) * aspect)) / 2;
  const d = (r / Math.sin(half)) * FIT;
  cam.position.set(tx + d * Math.cos(el) * Math.sin(az), ty + d * Math.sin(el), tz + d * Math.cos(el) * Math.cos(az));
  cam.lookAt(tx, ty, tz);
}

/**
 * Copies scroll progress into the shop store and poses the camera — first thing every
 * frame — and asks for the next frame: one per scroll change, and every frame while the
 * finished run spins, until the visitor scrolls back or pauses motion.
 */
function Rig({ progress, reduce }: { progress: MotionValue<number>; reduce: boolean }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const paused = useMotionPaused();

  useEffect(() => (reduce ? undefined : progress.on("change", () => invalidate())), [progress, reduce, invalidate]);
  // un-pausing restarts the spin's frame loop
  useEffect(() => invalidate(), [paused, invalidate]);

  useFrame((state, dt) => {
    shop.p = reduce ? 1 : clamp(progress.get());
    if (!reduce && shop.p >= AT.spin[0] && !getMotionPaused()) {
      shop.t += Math.min(dt, MAX_DT);
      state.invalidate();
    }
    pose(camera, shop.p, size.width / Math.max(1, size.height));
  }, -1);
  return null;
}

/** Studio light, offline: a few lightformers baked into an environment once — no HDR files. */
function Lights() {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[3, 6, 4]} intensity={1.1} />
      <directionalLight position={[-4, 3, -3]} intensity={0.35} color={COLORS.glow} />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.4} position={[0, 6, 1]} scale={[10, 5, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[-6, 2, 3]} scale={[7, 1.4, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[6, 1.5, -3]} scale={[7, 1.4, 1]} />
        <Lightformer form="rect" color={COLORS.glow} intensity={0.6} position={[0, 1, -7]} scale={[12, 1.5, 1]} />
      </Environment>
    </>
  );
}

function ShopStage({ progress }: { progress: MotionValue<number> }) {
  const reduce = useReducedMotion() ?? false;
  const wrap = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [dpr] = useState((): [number, number] => [
    1,
    clamp(Math.sqrt(PIXEL_BUDGET / (window.innerWidth * window.innerHeight)), 1, MAX_DPR),
  ]);

  useEffect(() => {
    const node = wrap.current;
    if (!node) return;
    // A latch: once the section is a screen and a half away, the canvas mounts and stays.
    const approach = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setNear(true);
        approach.disconnect();
      },
      { rootMargin: "150% 0px" },
    );
    const view = new IntersectionObserver((entries) => setOnScreen(entries.some((e) => e.isIntersecting)), {
      rootMargin: "120px 0px",
    });
    approach.observe(node);
    view.observe(node);
    return () => {
      approach.disconnect();
      view.disconnect();
    };
  }, []);

  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // Tags read the store for their first paint, before the rig's first frame.
  shop.p = reduce ? 1 : clamp(progress.get());

  // Built once: re-rendering it would re-bake the environment and re-reconcile every plate.
  const scene = useMemo(
    () => (
      <>
        <color attach="background" args={[COLORS.bg]} />
        <Lights />
        <Grid
          infiniteGrid
          cellSize={0.1}
          cellThickness={0.6}
          cellColor={COLORS.gridCell}
          sectionSize={0.5}
          sectionThickness={1}
          sectionColor={COLORS.gridSection}
          fadeDistance={12}
          fadeStrength={1.6}
        />
        <Rig progress={progress} reduce={reduce} />
        <DuctRun reduce={reduce} />
      </>
    ),
    [progress, reduce],
  );

  return (
    <div ref={wrap} className="absolute inset-0">
      {near && (
        <Canvas
          frameloop={reduce || (onScreen && pageVisible) ? "demand" : "never"}
          dpr={dpr}
          camera={{ fov: 30, near: 0.05, far: 30, position: [3, 2, 4] }}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          resize={{ scroll: false }}
          // compile the shaders while the section is still off screen, not on its first frame
          onCreated={({ gl, scene: root, camera }) => void gl.compileAsync(root, camera)}
        >
          {scene}
        </Canvas>
      )}
    </div>
  );
}

/** Its one prop is a stable MotionValue, so Shop's step changes never reach the canvas. */
export default memo(ShopStage);
