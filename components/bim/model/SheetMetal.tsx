"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { clamp, easeOutBack, easeOutCubic, lerp } from "@/lib/timing";
import { Tag, pointAlong, polyLength } from "../kit";
import { ARCH, GLOW } from "../materials";
import { bim } from "../store";
import { STORY, win } from "../timeline";
import { buildGeometries, installGlint, setGlint } from "./sheetmetal/gfx";
import {
  BOXES,
  COPING_SEGS,
  COPING_Y,
  CRICKET,
  EDGES,
  FLASH_SEGS,
  FLASH_Y,
  GLINT,
  PANELS,
  SHADE,
  SPARKS,
  TAGS,
  TAG_END,
  tagOpacity,
  type BoxRec,
  type SegRec,
} from "./sheetmetal/plan";

/**
 * Chapter 01 · Architectural sheet metal. Ribbed wall panels swing onto the end walls,
 * coping is laid around the parapet by two crews, counter-flashing goes into its reglet,
 * scuppers / conductor heads / downspouts come down the east face, the entry canopy and
 * the penthouse get standing-seam roofs — then a glint sweeps the lot. Everything is a
 * pure function of bim.story (see sheetmetal/plan.ts for placements and windows).
 */

const FIRST = STORY.sheetmetal.panels[0];
const SPARK_R = 0.09;
const SEG_JOINT = 0.012;

const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const o = new THREE.Object3D();
const v = new THREE.Vector3();

function placePanels(mesh: THREE.InstancedMesh, s: number) {
  for (let i = 0; i < PANELS.length; i++) {
    const p = PANELS[i];
    const k = win(s, p.w);
    if (k <= 0) {
      mesh.setMatrixAt(i, ZERO);
      continue;
    }
    const e = easeOutCubic(k);
    // carried in 1.4 m out and 0.6 m low, swung 40° open; easeOutBack bumps it onto the wall and locks
    o.position.set(p.x + p.out * 1.4 * (1 - e), p.y - 0.6 * (1 - e), p.z);
    o.rotation.set(0, p.rotY + p.out * 0.7 * (1 - easeOutBack(k)), 0);
    o.scale.set(easeOutCubic(Math.min(1, k / 0.3)), p.h, 1);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/** Run lengths drop onto the parapet and stretch to length. */
function placeSegs(mesh: THREE.InstancedMesh, segs: SegRec[], s: number, y: number, drop: number) {
  for (let i = 0; i < segs.length; i++) {
    const g = segs[i];
    const k = win(s, g.w);
    if (k <= 0) {
      mesh.setMatrixAt(i, ZERO);
      continue;
    }
    o.position.set(g.x, y + drop * (1 - easeOutCubic(k)), g.z);
    o.rotation.set(0, g.rotY, 0);
    o.scale.set((g.len - SEG_JOINT) * easeOutCubic(Math.min(1, k / 0.35)), 1, 1);
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function placeBoxes(mesh: THREE.InstancedMesh, boxes: BoxRec[], s: number) {
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const k = win(s, b.w);
    if (k <= 0) {
      mesh.setMatrixAt(i, ZERO);
      continue;
    }
    const e = b.ease(k);
    o.rotation.set(b.r[0], b.r[1], b.r[2]);
    o.position.set(b.c[0], b.c[1], b.c[2]);
    if (b.axis === -1) {
      o.scale.set(b.s[0] * e, b.s[1] * e, b.s[2] * e);
    } else {
      o.scale.set(b.s[0], b.s[1], b.s[2]).setComponent(b.axis, b.s[b.axis] * e);
      // hold the anchored end: pull the centre back along the (rotated) grow axis
      v.set(0, 0, 0).setComponent(b.axis, -b.dir * b.s[b.axis] * 0.5 * (1 - e)).applyQuaternion(o.quaternion);
      o.position.add(v);
    }
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

function placeSparks(mesh: THREE.InstancedMesh, s: number, lengths: readonly number[]) {
  for (let i = 0; i < SPARKS.length; i++) {
    const sp = SPARKS[i];
    const k = win(s, sp.w);
    if (k <= 0 || k >= 1) {
      mesh.setMatrixAt(i, ZERO);
      continue;
    }
    pointAlong(sp.path, k * lengths[i], o.position);
    o.rotation.set(0, 0, 0);
    o.scale.setScalar(SPARK_R * Math.min(1, k / 0.06, (1 - k) / 0.06));
    o.updateMatrix();
    mesh.setMatrixAt(i, o.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/** Lines whose element has landed by story s (EDGES.times is sorted). */
function landedLines(s: number) {
  const t = EDGES.times;
  let lo = 0;
  let hi = t.length;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (t[m] <= s) lo = m + 1;
    else hi = m;
  }
  return lo;
}

export default function SheetMetal() {
  const gfx = useMemo(() => {
    installGlint();
    return buildGeometries();
  }, []);
  const sparkLengths = useMemo(() => SPARKS.map((sp) => polyLength(sp.path)), []);

  const group = useRef<THREE.Group>(null);
  const panels = useRef<THREE.InstancedMesh>(null);
  const coping = useRef<THREE.InstancedMesh>(null);
  const flashing = useRef<THREE.InstancedMesh>(null);
  const boxes = useRef<THREE.InstancedMesh>(null);
  const shade = useRef<THREE.InstancedMesh>(null);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const cricket = useRef<THREE.Mesh>(null);
  const last = useRef(Number.NaN);

  useEffect(() => () => gfx.dispose(), [gfx]);

  useFrame(() => {
    // nothing in this chapter changes outside [FIRST, TAG_END]: skip the frame when the clamped clock holds still
    const s = clamp(bim.story, FIRST, TAG_END);
    if (s === last.current) return;
    const g = group.current;
    const pm = panels.current;
    const cm = coping.current;
    const fm = flashing.current;
    const bm = boxes.current;
    const sm = shade.current;
    const xm = sparks.current;
    const cr = cricket.current;
    if (!g || !pm || !cm || !fm || !bm || !sm || !xm || !cr) return;
    last.current = s;

    g.visible = s > FIRST;
    placePanels(pm, s);
    placeSegs(cm, COPING_SEGS, s, COPING_Y, 1.2);
    placeSegs(fm, FLASH_SEGS, s, FLASH_Y, 0.4);
    placeBoxes(bm, BOXES, s);
    placeBoxes(sm, SHADE, s);
    placeSparks(xm, s, sparkLengths);

    const kc = win(s, CRICKET.w);
    cr.visible = kc > 0;
    cr.scale.y = Math.max(1e-4, easeOutCubic(kc));

    gfx.edges.setDrawRange(0, 2 * landedLines(s));

    const kg = win(s, GLINT.w);
    const amt = kg > 0 && kg < 1 ? GLINT.peak * Math.min(1, kg / 0.1, (1 - kg) / 0.1) : 0;
    setGlint(lerp(GLINT.from, GLINT.to, kg), amt);
  });

  return (
    <>
      <group ref={group} visible={false}>
        <instancedMesh ref={panels} args={[gfx.panel, ARCH.sheetMetal, PANELS.length]} frustumCulled={false} />
        <instancedMesh ref={coping} args={[gfx.coping, ARCH.sheetMetal, COPING_SEGS.length]} frustumCulled={false} />
        <instancedMesh ref={flashing} args={[gfx.flashing, ARCH.sheetMetalShade, FLASH_SEGS.length]} frustumCulled={false} />
        <instancedMesh ref={boxes} args={[gfx.box, ARCH.sheetMetal, BOXES.length]} frustumCulled={false} />
        <instancedMesh ref={shade} args={[gfx.box, ARCH.sheetMetalShade, SHADE.length]} frustumCulled={false} />
        <mesh ref={cricket} geometry={gfx.cricket} material={ARCH.sheetMetal} position={[0, CRICKET.y, 0]} />
        <lineSegments args={[gfx.edges, ARCH.edge]} />
        <instancedMesh ref={sparks} args={[gfx.sphere, GLOW.spark, SPARKS.length]} frustumCulled={false} />
      </group>
      {TAGS.map((tag) => (
        <Tag key={tag.label} position={tag.at} show={() => tagOpacity(bim.story, tag.t)}>
          {tag.label}
        </Tag>
      ))}
    </>
  );
}
