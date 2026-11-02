"use client";

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { lerp, seg } from "@/lib/timing";
import {
  COLUMN,
  CORE,
  END_WALL,
  FLOORS,
  GRID_X,
  GRID_Z,
  LEVELS,
  PARAPET,
  PENTHOUSE,
  ROOF_Y,
  SHAFT,
  SLAB,
  SLAB_T,
} from "../geometry";
import { ARCH, GLOW } from "../materials";
import { bim } from "../store";
import { INTRO, arrive, ease, win, type Window } from "../timeline";
import { EDGE_EPS, box, dashGeometry, dashLine, inset, plate, revealed, setBox, solid, type Dash, type Rect } from "./structure/build";
import { FLASH, columnWin, footingWin, gradeSlabWin, roofWin, slabWin } from "./structure/schedule";

/**
 * The bare building, assembled by the load-time 4D sequence (bim.intro): pad
 * footings push up out of the ground and the slab-on-grade rises around them;
 * columns grow floor by floor, west to east, each landing with a placement
 * flash; every slab drops in and settles; the core and end walls climb; then
 * the roof closes — parapet, membrane, stair penthouse. A pure function of
 * bim.intro (scrubbing back un-builds it) and static once it reaches 1.
 * Bare concrete only: the sheet-metal trade clads it in chapter 01.
 */

/* ---- sizes geometry.ts leaves to the model ---- */
/** Pad footing with a plinth just proud of the slab, so it can be seen pushing up out of the ground. */
const FOOTING = { size: 1.3, top: 0.15, bottom: -0.75, rise: 1.6 } as const;
const GRADE_RISE = 0.45;
/** Slabs drop in from this far above their level. */
const SLAB_FALL = 2.5;
const MEMBRANE_T = 0.06;
/** "Being built" glow bands: thickness, width, column-cap size, and how far a landing flash spreads. */
const SPARK = { t: 0.05, w: 0.12, cap: COLUMN + 0.1, pop: 0.6 } as const;
/** The core stops under the roof slab, so its top never shares a plane with the slab. */
const CORE_TOP = ROOF_Y - SLAB_T;
const SHAFT_DASH = [0.3, 0.2] as const;

/** Floor slabs stop at the end walls' inner face, so no slab face is coplanar with a wall face. */
const SLAB_RECT: Rect = { x0: -END_WALL.inner, x1: END_WALL.inner, z0: -SLAB.z, z1: SLAB.z };
/** The roof field inside the parapet and the end walls. */
const ROOF_FIELD: Rect = { x0: -END_WALL.inner, x1: END_WALL.inner, z0: -(SLAB.z - PARAPET.t), z1: SLAB.z - PARAPET.t };
/** The core's wall centre-line, for its climbing glow band. */
const CORE_MID = inset(CORE, CORE.wall / 2);
/** Membrane pieces around the shaft opening, laid as one west -> east wipe. */
const MEMBRANE: readonly Rect[] = [
  { ...ROOF_FIELD, x1: SHAFT.x0 },
  { x0: SHAFT.x0, x1: SHAFT.x1, z0: ROOF_FIELD.z0, z1: SHAFT.z0 },
  { x0: SHAFT.x0, x1: SHAFT.x1, z0: SHAFT.z1, z1: ROOF_FIELD.z1 },
  { ...ROOF_FIELD, x0: SHAFT.x1 },
];

/** Tops of the four dropped slabs (L2, L3, L4, roof) and their windows. */
const SLAB_TOPS = LEVELS.slice(1).map((l) => l.y);
const SLAB_WINS = SLAB_TOPS.map((_, f) => slabWin(f));
const ROOF_WINS = [0, 1, 2].map(roofWin);

type Timed = { readonly w: Window };
type Spot = Timed & { readonly x: number; readonly z: number };
type Column = Spot & { readonly y0: number; readonly h: number };

/** One footing per grid intersection, west -> east (already in start order). */
const FOOTINGS: readonly Spot[] = GRID_X.flatMap((x, ix) => GRID_Z.map((z) => ({ x, z, w: footingWin(ix) })));

/** One column per intersection per floor, slab top to the soffit above, in start order. */
const COLUMNS: readonly Column[] = Array.from({ length: FLOORS }, (_, f) =>
  GRID_X.flatMap((x, ix) =>
    GRID_Z.map((z) => ({ x, z, y0: LEVELS[f].y, h: LEVELS[f + 1].y - SLAB_T - LEVELS[f].y, w: columnWin(f, ix) })),
  ),
)
  .flat()
  .sort((a, b) => a.w[0] - b.w[0]);

/** Started items form a prefix of a start-ordered list, so the rest are simply not drawn. */
function startedCount(list: readonly Timed[], p: number): number {
  let n = 0;
  while (n < list.length && list[n].w[0] < p) n++;
  return n;
}

/* ---- glow bands, one instanced draw: column caps, slab landings, climbing heads, membrane wipe ---- */
const SP_SLABS = COLUMNS.length;
const SP_CORE = SP_SLABS + 4 * SLAB_TOPS.length;
const SP_ENDS = SP_CORE + 4;
const SP_PARAPET = SP_ENDS + 2;
const SP_MEMBRANE = SP_PARAPET + 2;
const SP_PENT = SP_MEMBRANE + 1;
const SP_COUNT = SP_PENT + 4;
/** While any glow band can be lit (outside it the whole layer is skipped). */
const SPARKS_LIT: Window = [
  INTRO.columns[0],
  Math.max(COLUMNS[COLUMNS.length - 1].w[1] + FLASH, SLAB_WINS[SLAB_WINS.length - 1][1] + FLASH, INTRO.core[1], ROOF_WINS[2][1]),
];

/** Four bands (width w, thickness t) on the edges of r, centred at height y. w <= 0 hides them. */
function ring(mesh: THREE.InstancedMesh, i: number, r: Rect, y: number, w: number, t: number) {
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const lx = r.x1 - r.x0 + w;
  const lz = r.z1 - r.z0 + w;
  setBox(mesh, i, cx, y, r.z0, lx, t, w);
  setBox(mesh, i + 1, cx, y, r.z1, lx, t, w);
  setBox(mesh, i + 2, r.x0, y, cz, w, t, lz);
  setBox(mesh, i + 3, r.x1, y, cz, w, t, lz);
}

/* ---- column linework: CPU-updated, 12 edges per column (bottom ring, top ring, verticals) ---- */
const RING = [0, 1, 1, 2, 2, 3, 3, 0];
const CORNER = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;
/** [corner, isTop] for each of a column's 24 line vertices. */
const COL_VERTS: readonly (readonly [number, number])[] = [
  ...RING.map((c) => [c, 0] as const),
  ...RING.map((c) => [c, 1] as const),
  ...[0, 1, 2, 3].flatMap((c) => [[c, 0] as const, [c, 1] as const]),
];
const PER_COL = COL_VERTS.length;

function columnEdges(): THREE.BufferGeometry {
  const pos = new Float32Array(COLUMNS.length * PER_COL * 3);
  const hs = COLUMN / 2 + EDGE_EPS;
  COLUMNS.forEach((c, k) =>
    COL_VERTS.forEach(([corner, top], v) => {
      const o = (k * PER_COL + v) * 3;
      pos[o] = c.x + CORNER[corner][0] * hs;
      pos[o + 1] = c.y0 + top * c.h;
      pos[o + 2] = c.z + CORNER[corner][1] * hs;
    }),
  );
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  g.setDrawRange(0, 0);
  return g;
}

/** Thin dashed verticals on the open shaft's corners, drawn up with the core. */
function shaftMarks() {
  const out: Dash[] = [];
  const corners = [
    [SHAFT.x0, SHAFT.z0],
    [SHAFT.x1, SHAFT.z0],
    [SHAFT.x1, SHAFT.z1],
    [SHAFT.x0, SHAFT.z1],
  ] as const;
  for (const [x, z] of corners) dashLine(out, [x, 0, z], [x, ROOF_Y, z], SHAFT_DASH, INTRO.core);
  return dashGeometry(out);
}

function buildParts() {
  const zSide = (s: number): [number, number] => (s < 0 ? [-SLAB.z, -ROOF_FIELD.z1] : [ROOF_FIELD.z1, SLAB.z]);
  const xSide = (s: number): [number, number] => (s < 0 ? [-END_WALL.outer, -END_WALL.inner] : [END_WALL.inner, END_WALL.outer]);
  return {
    /** unit cube shared by every instanced part */
    unit: new THREE.BoxGeometry(1, 1, 1),
    grade: solid([box(-SLAB.x, SLAB.x, -SLAB_T, 0, -SLAB.z, SLAB.z)]),
    /** one slab with the shaft opening, top face at y = 0; each floor's group places it */
    slab: solid([plate(SLAB_RECT, [SHAFT], -SLAB_T, SLAB_T)]),
    core: solid([plate(CORE, [inset(CORE, CORE.wall)], 0, CORE_TOP)]),
    ends: solid([-1, 1].map((s) => box(...xSide(s), 0, PARAPET.top, -SLAB.z, SLAB.z))),
    /** north and south parapets, base at y = 0; the group sits on the roof slab */
    parapet: solid([-1, 1].map((s) => box(-END_WALL.inner, END_WALL.inner, 0, PARAPET.top - ROOF_Y, ...zSide(s)))),
    penthouse: solid([box(PENTHOUSE.x0, PENTHOUSE.x1, 0, PENTHOUSE.top - ROOF_Y, PENTHOUSE.z0, PENTHOUSE.z1)]),
    colEdges: columnEdges(),
    shaft: shaftMarks(),
  };
}
type Parts = ReturnType<typeof buildParts>;

function disposeParts(p: Parts) {
  p.unit.dispose();
  for (const s of [p.grade, p.slab, p.core, p.ends, p.parapet, p.penthouse]) {
    s.mesh.dispose();
    s.edges.dispose();
  }
  p.colEdges.dispose();
  p.shaft.geometry.dispose();
}

/* ---- per-frame placement (no allocation; called only when bim.intro changed) ---- */

function placeGround(foot: THREE.InstancedMesh, grade: THREE.Group, p: number) {
  const n = startedCount(FOOTINGS, p);
  const h = FOOTING.top - FOOTING.bottom;
  for (let i = 0; i < n; i++) {
    const f = FOOTINGS[i];
    const y = (FOOTING.top + FOOTING.bottom) / 2 - FOOTING.rise * (1 - arrive(p, f.w));
    setBox(foot, i, f.x, y, f.z, FOOTING.size, h, FOOTING.size);
  }
  foot.count = n;
  foot.visible = n > 0;
  foot.instanceMatrix.needsUpdate = true;
  grade.visible = p > gradeSlabWin[0];
  grade.position.y = -GRADE_RISE * (1 - arrive(p, gradeSlabWin));
}

function placeColumns(cols: THREE.InstancedMesh, lines: THREE.LineSegments, sparks: THREE.InstancedMesh, p: number) {
  const n = startedCount(COLUMNS, p);
  const attr = lines.geometry.getAttribute("position") as THREE.BufferAttribute;
  const pos = attr.array as Float32Array;
  for (let k = 0; k < COLUMNS.length; k++) {
    const c = COLUMNS[k];
    const g = k < n ? arrive(p, c.w) : 0;
    if (k < n) {
      setBox(cols, k, c.x, c.y0 + (c.h * g) / 2, c.z, COLUMN, c.h * g, COLUMN);
      const yb = c.y0 + EDGE_EPS;
      const yt = yb + (c.h - 2 * EDGE_EPS) * g;
      for (let v = 0; v < PER_COL; v++) pos[(k * PER_COL + v) * 3 + 1] = COL_VERTS[v][1] ? yt : yb;
    }
    // Placement spark: rides the top while the column grows, then pops and fades as it lands.
    const f = seg(p, c.w[1], c.w[1] + FLASH);
    const growing = g > 0 && g < 1;
    const flashing = f > 0 && f < 1;
    const s = SPARK.cap * (growing ? 1 : 1 + SPARK.pop * f);
    const t = growing ? SPARK.t : flashing ? SPARK.t * (1 - f) : 0;
    setBox(sparks, k, c.x, c.y0 + c.h * g + t / 2, c.z, s, t, s);
  }
  cols.count = n;
  cols.visible = n > 0;
  cols.instanceMatrix.needsUpdate = true;
  attr.needsUpdate = true;
  lines.geometry.setDrawRange(0, n * PER_COL);
  lines.visible = n > 0;
}

function placeSlabs(slabs: readonly (THREE.Group | null)[], sparks: THREE.InstancedMesh, p: number) {
  for (let f = 0; f < SLAB_TOPS.length; f++) {
    const w = SLAB_WINS[f];
    const group = slabs[f];
    if (group) {
      group.visible = p > w[0];
      group.position.y = SLAB_TOPS[f] + SLAB_FALL * (1 - arrive(p, w));
    }
    // Landing flash: the slab's perimeter glows, spreads and fades.
    const k = seg(p, w[1], w[1] + FLASH);
    const width = k > 0 && k < 1 ? SPARK.w * (1 + 4 * SPARK.pop * k) : 0;
    ring(sparks, SP_SLABS + 4 * f, SLAB_RECT, SLAB_TOPS[f] + SPARK.t / 2, width, SPARK.t * (1 - k));
  }
}

function placeWalls(
  core: THREE.Group,
  ends: THREE.Group,
  shaft: THREE.LineSegments,
  shaftTimes: Float32Array,
  sparks: THREE.InstancedMesh,
  p: number,
) {
  // Core and end walls climb steadily, like slip-forms; a glow band rides the top of each.
  const k = win(p, INTRO.core);
  core.visible = ends.visible = k > 0;
  core.scale.y = ends.scale.y = Math.max(k, 1e-4);
  shaft.geometry.setDrawRange(0, 2 * revealed(shaftTimes, p));
  shaft.visible = k > 0;
  const on = k > 0 && k < 1;
  ring(sparks, SP_CORE, CORE_MID, CORE_TOP * k + SPARK.t / 2, on ? CORE.wall + 0.06 : 0, SPARK.t);
  const wallW = END_WALL.outer - END_WALL.inner + 0.06;
  for (let s = 0; s < 2; s++) {
    const x = (s ? 1 : -1) * ((END_WALL.inner + END_WALL.outer) / 2);
    setBox(sparks, SP_ENDS + s, x, PARAPET.top * k + SPARK.t / 2, 0, on ? wallW : 0, SPARK.t, 2 * SLAB.z + 0.06);
  }
}

function placeRoof(
  parapet: THREE.Group,
  membrane: THREE.InstancedMesh,
  penthouse: THREE.Group,
  sparks: THREE.InstancedMesh,
  p: number,
) {
  const a = ease(p, ROOF_WINS[0]);
  parapet.visible = a > 0;
  parapet.scale.y = Math.max(a, 1e-4);
  const ay = ROOF_Y + (PARAPET.top - ROOF_Y) * a + SPARK.t / 2;
  for (let s = 0; s < 2; s++) {
    const z = (s ? 1 : -1) * (SLAB.z - PARAPET.t / 2);
    setBox(sparks, SP_PARAPET + s, 0, ay, z, a > 0 && a < 1 ? 2 * END_WALL.inner + 0.06 : 0, SPARK.t, PARAPET.t + 0.06);
  }

  // The membrane is laid west -> east: each piece shows up to the wipe front.
  const m = ease(p, ROOF_WINS[1]);
  const front = lerp(ROOF_FIELD.x0, ROOF_FIELD.x1, m);
  for (let i = 0; i < MEMBRANE.length; i++) {
    const r = MEMBRANE[i];
    const x1 = Math.min(r.x1, front);
    setBox(membrane, i, (r.x0 + x1) / 2, ROOF_Y + MEMBRANE_T / 2, (r.z0 + r.z1) / 2, x1 - r.x0, MEMBRANE_T, r.z1 - r.z0);
  }
  membrane.visible = m > 0;
  membrane.instanceMatrix.needsUpdate = true;
  const depth = ROOF_FIELD.z1 - ROOF_FIELD.z0;
  setBox(sparks, SP_MEMBRANE, front, ROOF_Y + MEMBRANE_T + SPARK.t / 2, 0, m > 0 && m < 1 ? SPARK.w : 0, SPARK.t, depth);

  const h = ease(p, ROOF_WINS[2]);
  penthouse.visible = h > 0;
  penthouse.scale.y = Math.max(h, 1e-4);
  const hy = ROOF_Y + (PENTHOUSE.top - ROOF_Y) * h + SPARK.t / 2;
  ring(sparks, SP_PENT, PENTHOUSE, hy, h > 0 && h < 1 ? SPARK.w : 0, SPARK.t);
}

export default function Structure() {
  const parts = useMemo(buildParts, []);
  useEffect(() => () => disposeParts(parts), [parts]);

  const foot = useRef<THREE.InstancedMesh>(null);
  const grade = useRef<THREE.Group>(null);
  const cols = useRef<THREE.InstancedMesh>(null);
  const colLines = useRef<THREE.LineSegments>(null);
  const slabs = useRef<(THREE.Group | null)[]>([]);
  const core = useRef<THREE.Group>(null);
  const ends = useRef<THREE.Group>(null);
  const shaft = useRef<THREE.LineSegments>(null);
  const parapet = useRef<THREE.Group>(null);
  const membrane = useRef<THREE.InstancedMesh>(null);
  const penthouse = useRef<THREE.Group>(null);
  const sparks = useRef<THREE.InstancedMesh>(null);
  const last = useRef(Number.NaN);

  useFrame(() => {
    const p = bim.intro;
    if (p === last.current) return;
    const fo = foot.current;
    const gr = grade.current;
    const co = cols.current;
    const cl = colLines.current;
    const cr = core.current;
    const en = ends.current;
    const sh = shaft.current;
    const pa = parapet.current;
    const me = membrane.current;
    const pe = penthouse.current;
    const sp = sparks.current;
    if (!fo || !gr || !co || !cl || !cr || !en || !sh || !pa || !me || !pe || !sp) return;
    last.current = p;

    placeGround(fo, gr, p);
    placeColumns(co, cl, sp, p);
    placeSlabs(slabs.current, sp, p);
    placeWalls(cr, en, sh, parts.shaft.times, sp, p);
    placeRoof(pa, me, pe, sp, p);
    sp.visible = p > SPARKS_LIT[0] && p < SPARKS_LIT[1];
    sp.instanceMatrix.needsUpdate = true;
  });

  return (
    <group name="structure">
      <instancedMesh ref={foot} args={[parts.unit, ARCH.concrete, FOOTINGS.length]} frustumCulled={false} />
      <group ref={grade}>
        <mesh geometry={parts.grade.mesh} material={ARCH.concrete} />
        <lineSegments geometry={parts.grade.edges} material={ARCH.edge} />
      </group>

      <instancedMesh ref={cols} args={[parts.unit, ARCH.concrete, COLUMNS.length]} frustumCulled={false} />
      <lineSegments ref={colLines} geometry={parts.colEdges} material={ARCH.edge} frustumCulled={false} />

      {SLAB_TOPS.map((y, f) => (
        <group
          key={y}
          ref={(g) => {
            slabs.current[f] = g;
          }}
        >
          <mesh geometry={parts.slab.mesh} material={ARCH.concrete} />
          <lineSegments geometry={parts.slab.edges} material={ARCH.edge} />
        </group>
      ))}

      <group ref={core}>
        <mesh geometry={parts.core.mesh} material={ARCH.concrete} />
        <lineSegments geometry={parts.core.edges} material={ARCH.edge} />
      </group>
      <lineSegments ref={shaft} geometry={parts.shaft.geometry} material={ARCH.edge} />
      <group ref={ends}>
        <mesh geometry={parts.ends.mesh} material={ARCH.concreteShade} />
        <lineSegments geometry={parts.ends.edges} material={ARCH.edge} />
      </group>

      <group ref={parapet} position-y={ROOF_Y}>
        <mesh geometry={parts.parapet.mesh} material={ARCH.concrete} />
        <lineSegments geometry={parts.parapet.edges} material={ARCH.edge} />
      </group>
      <instancedMesh ref={membrane} args={[parts.unit, ARCH.roof, MEMBRANE.length]} frustumCulled={false} />
      <group ref={penthouse} position-y={ROOF_Y}>
        <mesh geometry={parts.penthouse.mesh} material={ARCH.concrete} />
        <lineSegments geometry={parts.penthouse.edges} material={ARCH.edge} />
      </group>

      <instancedMesh ref={sparks} args={[parts.unit, GLOW.spark, SP_COUNT]} frustumCulled={false} />
    </group>
  );
}
