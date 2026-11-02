"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import type { V3 } from "./geometry";
import { bim } from "./store";

/**
 * Small shared toolkit for the model parts: polyline math, travelling pulses
 * (air in ducts, data on lines) and screen-aligned BIM tags.
 */

export type Polyline = readonly V3[];

export function polyLength(pts: Polyline): number {
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay, az] = pts[i - 1];
    const [bx, by, bz] = pts[i];
    L += Math.hypot(bx - ax, by - ay, bz - az);
  }
  return L;
}

/** The point at distance d along the polyline (clamped), written into `out`. */
export function pointAlong(pts: Polyline, d: number, out: THREE.Vector3): THREE.Vector3 {
  let rest = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay, az] = pts[i - 1];
    const [bx, by, bz] = pts[i];
    const seg = Math.hypot(bx - ax, by - ay, bz - az);
    if (rest <= seg || i === pts.length - 1) {
      const t = seg > 0 ? Math.min(1, rest / seg) : 0;
      return out.set(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t);
    }
    rest -= seg;
  }
  const [x, y, z] = pts[pts.length - 1] ?? [0, 0, 0];
  return out.set(x, y, z);
}

/** The first fraction t (0..1) of a polyline — for drawing lines on. Returns at least two points. */
export function partialPolyline(pts: Polyline, t: number): V3[] {
  const total = polyLength(pts);
  const target = total * Math.min(1, Math.max(0, t));
  const out: V3[] = [pts[0]];
  let run = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay, az] = pts[i - 1];
    const [bx, by, bz] = pts[i];
    const seg = Math.hypot(bx - ax, by - ay, bz - az);
    if (run + seg >= target) {
      const k = seg > 0 ? (target - run) / seg : 0;
      out.push([ax + (bx - ax) * k, ay + (by - ay) * k, az + (bz - az) * k]);
      return out;
    }
    out.push(pts[i]);
    run += seg;
  }
  return out;
}

const dummy = new THREE.Object3D();
const tmp = new THREE.Vector3();
const ahead = new THREE.Vector3();
const sphere = new THREE.SphereGeometry(1, 10, 8);

type PulsesProps = {
  path: Polyline;
  /** dots on the path at once */
  count: number;
  /** metres per second */
  speed: number;
  /** dot radius in metres */
  size: number;
  material: THREE.Material;
  /** 0..1 each frame — 0 hides the dots (system not built yet / flows not running). */
  gate: () => number;
  /** length / width of each streak along the direction of travel (1 = round dot) */
  stretch?: number;
};

/**
 * Light streaks travelling a polyline at constant speed, evenly spaced, each
 * stretched along its direction of travel and fading in at the start and out
 * at the end. One instanced draw call per path. Driven by bim.time, so it
 * freezes with the stage and the Pause motion switch; hidden under reduced motion.
 */
export function Pulses({ path, count, speed, size, material, gate, stretch = 3.2 }: PulsesProps) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const length = useMemo(() => polyLength(path), [path]);
  const n = bim.quality === "low" ? Math.max(1, Math.ceil(count / 2)) : count;

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const g = bim.reduced ? 0 : gate();
    mesh.visible = g > 0.001;
    if (!mesh.visible) return;
    for (let i = 0; i < n; i++) {
      const d = (bim.time * speed + (i * length) / n) % length;
      const u = d / length;
      const fade = Math.min(1, u / 0.06, (1 - u) / 0.08);
      pointAlong(path, d, tmp);
      pointAlong(path, Math.min(length, d + 0.05), ahead);
      dummy.position.copy(tmp);
      if (ahead.distanceToSquared(tmp) > 1e-8) dummy.lookAt(ahead); // +Z along the flow
      const s = size * Math.max(0, fade) * g;
      dummy.scale.set(s, s, s * stretch);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={ref} args={[sphere, material, n]} frustumCulled={false} />;
}

type TagProps = {
  position: V3;
  children: ReactNode;
  /** 0..1 each frame */
  show: () => number;
  /** screen-space nudge in px, e.g. [12, -12] to sit up-right of the anchor */
  offset?: readonly [number, number];
};

function applyShow(node: HTMLDivElement, o: number) {
  node.style.opacity = o.toFixed(3);
  node.style.visibility = o < 0.01 ? "hidden" : "visible";
}

/**
 * Screen-aligned BIM annotation anchored to a model point (Revit-style tag).
 * The drei Html overlay exists only while the tag is visible (React state flips
 * at the visibility edges only), so hidden tags cost nothing per frame; opacity
 * is set imperatively every frame. Html mounts its children asynchronously, so
 * the node starts hidden and picks up the latest value the moment it attaches.
 */
export function Tag({ position, children, show, offset = [10, -10] }: TagProps) {
  const el = useRef<HTMLDivElement | null>(null);
  const last = useRef(0);
  const shown = useRef(false);
  const [mounted, setMounted] = useState(false);
  useFrame(() => {
    last.current = show();
    const want = last.current > 0.001;
    if (want !== shown.current) {
      shown.current = want;
      setMounted(want);
    }
    if (el.current) applyShow(el.current, last.current);
  });
  const attach = (node: HTMLDivElement | null) => {
    el.current = node;
    if (node) applyShow(node, last.current);
  };
  if (!mounted) return null;
  return (
    <Html position={position as unknown as THREE.Vector3Tuple} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <div
        ref={attach}
        className="bim-tag"
        style={{ opacity: 0, visibility: "hidden", transform: `translate(${offset[0]}px, ${offset[1]}px) translateY(-100%)` }}
      >
        {children}
      </div>
    </Html>
  );
}
