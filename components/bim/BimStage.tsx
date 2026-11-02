"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { motionConfig } from "@/lib/motion-config";
import Scene from "./Scene";
import { bim } from "./store";

const LABEL =
  "Illustrative 3D model of a typical four-storey commercial building. It assembles from the column grid up, then " +
  "each trade goes in as you scroll: architectural sheet metal on the walls and roof edge, a rooftop HVAC unit with " +
  "supply and return ducts on every floor, restroom exhaust with a rooftop fan and an outside-air hood, EMS controls " +
  "wired to sensors on each floor, and preventative-maintenance checks on the equipment.";

/** Total rendered pixels we allow at the top tier (DPR is capped by this, not just by the ratio). */
const PIXEL_BUDGET = 2.6e6;
const DPR = { min: 1, max: 1.75, low: 1.5, step: 0.25 };

/** Decide quality and motion once, before the canvas is created (it reads them at mount). */
function configure() {
  bim.reduced = motionConfig.prefersReduced();
  bim.quality = motionConfig.isLowEnd() || window.innerWidth < 768 ? "low" : "high";
  if (bim.reduced) {
    bim.intro = 1;
    bim.story = bim.storyTarget = 1;
    bim.hero = bim.heroTarget = 1;
  }
}

function budgetDpr(high: boolean) {
  const byPixels = Math.sqrt(PIXEL_BUDGET / Math.max(1, window.innerWidth * window.innerHeight));
  const cap = Math.min(high ? DPR.max : DPR.low, window.devicePixelRatio || 1);
  return Math.max(DPR.min, Math.min(cap, byPixels));
}

/**
 * The fixed WebGL stage behind the hero and the systems story. It renders only
 * while one of those sections is on screen; everything after the story scrolls
 * over it on opaque backgrounds.
 */
export default function BimStage() {
  const configured = useRef(false);
  if (!configured.current) {
    configure();
    configured.current = true;
  }
  const high = bim.quality === "high" && !bim.reduced;
  const [active, setActive] = useState(true);
  const [ready, setReady] = useState(false);
  const [dpr, setDpr] = useState(() => budgetDpr(high));

  // Render only while the hero or the story is on screen.
  useEffect(() => {
    const els = ["hero", "systems"].map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const seen = new Map<Element, boolean>();
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) seen.set(e.target, e.isIntersecting);
      setActive([...seen.values()].some(Boolean));
    });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Pointer parallax (fine pointers only).
  useEffect(() => {
    if (bim.reduced || !window.matchMedia("(pointer: fine)").matches) return;
    const move = (e: PointerEvent) => {
      bim.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      bim.pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => window.removeEventListener("pointermove", move);
  }, []);

  // Stable callbacks, so the memoised scene below never re-renders.
  const onReady = useCallback(() => {
    bim.stageReady = true;
    setReady(true);
  }, []);
  const ceiling = useMemo(() => budgetDpr(high), [high]);
  const onDecline = useCallback(() => setDpr((d) => Math.max(DPR.min, d - DPR.step)), []);
  const onIncline = useCallback(() => setDpr((d) => Math.min(ceiling, d + DPR.step)), [ceiling]);

  // Visibility / DPR changes re-render this wrapper, never the R3F tree (and never the composer).
  const scene = useMemo(
    () => <Scene postFx={high} onReady={onReady} onDecline={onDecline} onIncline={onIncline} />,
    [high, onReady, onDecline, onIncline],
  );
  const frameloop = bim.reduced ? "demand" : active ? "always" : "never";

  return (
    <div
      role="img"
      aria-label={LABEL}
      className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-1000 ease-out"
      style={{ opacity: ready ? 1 : 0, visibility: active ? "visible" : "hidden" }}
    >
      <Canvas
        dpr={dpr}
        frameloop={frameloop}
        // the post-processing composer multisamples on its own target, so the default buffer doesn't need MSAA
        gl={{ antialias: !high, alpha: false, stencil: false, powerPreference: "high-performance" }}
        camera={{ fov: 30, near: 0.5, far: 700, position: [62, 34, 74] }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1;
        }}
      >
        {scene}
      </Canvas>
    </div>
  );
}
