"use client";

import { useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Grid } from "@react-three/drei";
import { COLORS } from "./materials";
import { bim } from "./store";
import { INTRO, win } from "./timeline";

const PAD = { w: 52, d: 40 };

/**
 * The site: a faint infinite drafting grid (2 m sections land on every column
 * grid line) and a slightly lighter site pad that fades in with the 4D sequence.
 */
export default function Ground() {
  const pad = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (pad.current) pad.current.opacity = win(bim.intro, INTRO.grid);
  });
  return (
    <group>
      <Grid
        position={[0, -0.02, 0]}
        args={[10, 10]}
        infiniteGrid
        cellSize={1}
        cellThickness={0.5}
        cellColor={COLORS.gridCell}
        sectionSize={2}
        sectionThickness={0.9}
        sectionColor={COLORS.gridSection}
        fadeDistance={170}
        fadeStrength={2}
      />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.01}>
        <planeGeometry args={[PAD.w, PAD.d]} />
        <meshStandardMaterial ref={pad} color="#12161c" roughness={1} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
