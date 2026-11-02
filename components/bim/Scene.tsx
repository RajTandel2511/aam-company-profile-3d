"use client";

import { useEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer, PerformanceMonitor } from "@react-three/drei";
import { getMotionPaused } from "@/lib/motion-pause";
import Atmosphere from "./Atmosphere";
import CameraRig from "./CameraRig";
import ChapterScan from "./ChapterScan";
import Effects from "./Effects";
import Ground from "./Ground";
import SectionBox from "./SectionBox";
import { applyXray, COLORS, preToneMapped } from "./materials";
import { bim } from "./store";
import { INTRO_SECONDS, STORY, ease } from "./timeline";
import Annotations from "./model/Annotations";
import Controls from "./model/Controls";
import Envelope from "./model/Envelope";
import Exhaust from "./model/Exhaust";
import Finale from "./model/Finale";
import Hvac from "./model/Hvac";
import Service from "./model/Service";
import SheetMetal from "./model/SheetMetal";
import Structure from "./model/Structure";

/**
 * How fast the eased clocks chase their scroll targets (1/s). Lenis already
 * smooths the scroll itself, so this only takes the edge off — a tight follow
 * keeps the model glued to the scroll instead of trailing it.
 */
const FOLLOW = 10;

/** Fog always passes through tone mapping; pre-compensated so far geometry fades into --void exactly. */
const FOG = preToneMapped(COLORS.void);

/**
 * Eases the clocks once per frame, before any part reads them (negative
 * priority runs first and leaves R3F's own render in place).
 */
function Clocks() {
  useFrame((_, delta) => {
    if (bim.reduced) {
      bim.intro = bim.story = bim.hero = 1;
    } else {
      const dt = Math.min(delta, 0.1);
      // ambient loops (flows, pulses, dust) run on bim.time: the Pause motion switch freezes them
      if (!getMotionPaused()) bim.time += dt;
      // A visitor who scrolls on before the 4D sequence finishes shouldn't wait for it.
      const hurry = bim.storyTarget > 0.005 || bim.heroTarget > 0.3 ? 5 : 1;
      if (bim.stageReady) bim.intro = Math.min(1, bim.intro + (dt / INTRO_SECONDS) * hurry);
      bim.story = THREE.MathUtils.damp(bim.story, bim.storyTarget, FOLLOW, dt);
      bim.hero = THREE.MathUtils.damp(bim.hero, bim.heroTarget, FOLLOW, dt);
    }
    bim.xray = ease(bim.story, STORY.xray);
    bim.cut = ease(bim.story, STORY.section);
    applyXray(bim.xray);
  }, -10);
  return null;
}

/**
 * Compiles every material (hidden trades included) before the canvas fades in,
 * so no shader compiles mid-scroll when a new system appears.
 */
function Prewarm({ onReady }: { onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onReady();
    };
    const cap = setTimeout(finish, 2500); // never hold the stage back for long
    const raf = requestAnimationFrame(() => {
      gl.compileAsync(scene, camera).then(finish, finish);
    });
    return () => {
      clearTimeout(cap);
      cancelAnimationFrame(raf);
    };
  }, [gl, scene, camera, onReady]);
  return null;
}

/**
 * Reduced motion renders on demand (a still model). Html tags and the
 * environment map attach a beat later, so request frames for a moment.
 */
function Settle() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!bim.reduced) return;
    const tick = setInterval(() => invalidate(), 120);
    const stop = setTimeout(() => clearInterval(tick), 2500);
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
    };
  }, [invalidate]);
  return null;
}

type Props = {
  postFx: boolean;
  onReady: () => void;
  onDecline: () => void;
  onIncline: () => void;
};

export default function Scene({ postFx, onReady, onDecline, onIncline }: Props) {
  // the clear colour skips tone mapping without the composer, and goes through it with the composer
  const background = postFx ? preToneMapped(COLORS.void) : new THREE.Color(COLORS.void);
  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[FOG, 110, 300]} />
      <PerformanceMonitor onDecline={onDecline} onIncline={onIncline} flipflops={3} />

      <hemisphereLight args={["#d6e6ff", "#0a0c10", 0.6]} />
      <directionalLight position={[45, 70, 35]} intensity={1.5} />
      <directionalLight position={[-40, 25, -45]} intensity={0.35} color="#7fb0ff" />
      {/* Reflections for metal and glass, built from light cards — no external HDR file. */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 40, 30]} scale={[80, 24, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#8fbaff" position={[-50, 14, 0]} rotation-y={Math.PI / 2} scale={[50, 12, 1]} />
        <Lightformer form="rect" intensity={1.1} color="#ffffff" position={[50, 10, -10]} rotation-y={-Math.PI / 2} scale={[40, 8, 1]} />
        <Lightformer form="ring" intensity={1.6} position={[25, 30, -40]} scale={12} />
      </Environment>

      <Clocks />
      <Prewarm onReady={onReady} />
      <Settle />
      <CameraRig />

      <Ground />
      <Atmosphere />
      <Structure />
      <Envelope />
      <Annotations />
      <SheetMetal />
      <Hvac />
      <Exhaust />
      <Controls />
      <Service />
      <Finale />
      <ChapterScan />
      <SectionBox />

      {postFx && <Effects />}
    </>
  );
}
