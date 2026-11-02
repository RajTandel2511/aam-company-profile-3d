"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { easeInOutCubic, seg } from "@/lib/timing";
import { COLORS } from "./materials";
import { bim } from "./store";
import { CHAPTERS } from "./timeline";

/** One scan per trade chapter, in that trade's legend colour. */
const SCANS = [
  { id: "sheetmetal", color: COLORS.sheetMetal },
  { id: "hvac", color: COLORS.supplyGlow },
  { id: "exhaust", color: COLORS.exhaustGlow },
  { id: "controls", color: COLORS.signal },
  { id: "maintenance", color: COLORS.signal },
].map((s) => ({ ...s, start: CHAPTERS.find((c) => c.id === s.id)?.range[0] ?? 0 }));

/** Share of story progress a scan takes to rise from grade to above the roof. */
const SPAN = 0.04;
/** Wider than the building, so the bright outline rides around the outside of the walls. */
const FOOT = { w: 42, d: 30, top: 21.5 } as const;

/**
 * As each trade's chapter begins, a thin plane of light rises through the
 * building in that trade's colour — the model "scanning in" the new system.
 * A pure function of scroll progress, so it also runs (in reverse) when you
 * scroll back up.
 */
export default function ChapterScan() {
  const group = useRef<THREE.Group>(null);
  const { fill, line, edges } = useMemo(
    () => ({
      fill: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
      line: new THREE.LineBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
      edges: new THREE.EdgesGeometry(new THREE.PlaneGeometry(FOOT.w, FOOT.d)),
    }),
    [],
  );
  useEffect(
    () => () => {
      fill.dispose();
      line.dispose();
      edges.dispose();
    },
    [fill, line, edges],
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const scan = bim.reduced ? undefined : SCANS.find((s) => bim.story >= s.start && bim.story <= s.start + SPAN);
    g.visible = !!scan;
    if (!scan) return;
    const t = seg(bim.story, scan.start, scan.start + SPAN);
    g.position.y = easeInOutCubic(t) * FOOT.top;
    const a = Math.sin(Math.PI * t);
    fill.color.set(scan.color).multiplyScalar(1.6);
    line.color.set(scan.color).multiplyScalar(2.6);
    fill.opacity = 0.14 * a;
    line.opacity = a;
  });

  return (
    <group ref={group} visible={false}>
      <mesh rotation-x={-Math.PI / 2} material={fill}>
        <planeGeometry args={[FOOT.w, FOOT.d]} />
      </mesh>
      <lineSegments rotation-x={-Math.PI / 2} geometry={edges} material={line} />
    </group>
  );
}
