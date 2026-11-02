import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { V3 } from "../../geometry";
import type { Window } from "../../timeline";

/**
 * Geometry helpers for the bare building (Structure, Envelope, Annotations):
 * solids with clean BIM linework, an allocation-free instance writer, and
 * dashed lines that reveal in order through a single draw range.
 */

/** A plan rectangle (metres): x west -> east, z north -> south. */
export type Rect = { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number };

export const inset = (r: Rect, d: number): Rect => ({ x0: r.x0 + d, x1: r.x1 - d, z0: r.z0 + d, z1: r.z1 - d });

/** Axis-aligned box between two corners. */
export function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number): THREE.BufferGeometry {
  return new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

/** A plan rectangle minus holes, extruded from y0 up by h: a slab with its shaft opening, or the hollow core. */
export function plate(outer: Rect, holes: readonly Rect[], y0: number, h: number): THREE.BufferGeometry {
  // Shape space is (x, -z): standing the extrusion up (-90 deg about X) maps shape y back to world z, depth to +y.
  const trace = <T extends THREE.Path>(path: T, r: Rect): T => {
    path.moveTo(r.x0, -r.z0);
    path.lineTo(r.x1, -r.z0);
    path.lineTo(r.x1, -r.z1);
    path.lineTo(r.x0, -r.z1);
    path.closePath();
    return path;
  };
  const shape = trace(new THREE.Shape(), outer);
  shape.holes = holes.map((r) => trace(new THREE.Path(), r));
  return new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false }).rotateX(-Math.PI / 2).translate(0, y0, 0);
}

/** Merge into one geometry and free the inputs. */
export function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = mergeGeometries(geos) as THREE.BufferGeometry | null;
  for (const g of geos) g.dispose();
  if (!out) throw new Error("structure: cannot merge geometries with different attributes");
  return out;
}

/** How far linework stands off the faces it outlines, so it never z-fights them. */
export const EDGE_EPS = 0.015;

/** Crease linework for one solid, nudged EDGE_EPS outward on its bounding faces. */
export function edgesOf(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const lines = new THREE.EdgesGeometry(geo, 15);
  geo.computeBoundingBox();
  const { min, max } = geo.boundingBox as THREE.Box3;
  const out = (v: number, lo: number, hi: number) =>
    Math.abs(v - lo) < 1e-4 ? v - EDGE_EPS : Math.abs(v - hi) < 1e-4 ? v + EDGE_EPS : v;
  const p = lines.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, out(p.getX(i), min.x, max.x), out(p.getY(i), min.y, max.y), out(p.getZ(i), min.z, max.z));
  }
  return lines;
}

/** Separate solids as one mesh geometry plus one linework geometry (edges taken per part, before merging). */
export function solid(parts: THREE.BufferGeometry[]): { mesh: THREE.BufferGeometry; edges: THREE.BufferGeometry } {
  const edges = merge(parts.map(edgesOf));
  return { mesh: merge(parts), edges };
}

const M = new THREE.Matrix4();

/**
 * Instance i of a unit-cube InstancedMesh as an axis-aligned box: centre (x, y, z), size (sx, sy, sz).
 * Any size <= 0 collapses the whole box — a box flattened on one axis would still draw, with NaN normals.
 */
export function setBox(
  mesh: THREE.InstancedMesh,
  i: number,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
): void {
  const k = sx > 0 && sy > 0 && sz > 0 ? 1 : 0;
  mesh.setMatrixAt(i, M.makeScale(sx * k, sy * k, sz * k).setPosition(x, y, z));
}

/** One dash of a dashed line, with the clock value (bim.intro) at which it appears. */
export type Dash = { readonly a: V3; readonly b: V3; readonly t: number };

/** Dashes along a -> b in a repeating [on, off, on, off ...] pattern (metres), revealed a -> b across window w. */
export function dashLine(out: Dash[], a: V3, b: V3, pattern: readonly number[], w: Window): void {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const at = (s: number): V3 => [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
  for (let s = 0, k = 0; s < L; k++) {
    const len = pattern[k % pattern.length];
    if (k % 2 === 0) out.push({ a: at(s / L), b: at(Math.min(L, s + len) / L), t: w[0] + (w[1] - w[0]) * (s / L) });
    s += len;
  }
}

/** All dashes as one LineSegments geometry ordered by reveal time, plus those times for `revealed`. */
export function dashGeometry(dashes: readonly Dash[]): { geometry: THREE.BufferGeometry; times: Float32Array } {
  const sorted = [...dashes].sort((p, q) => p.t - q.t);
  const pos = new Float32Array(sorted.length * 6);
  sorted.forEach((d, i) => pos.set([...d.a, ...d.b], i * 6));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geometry.setDrawRange(0, 0);
  return { geometry, times: Float32Array.from(sorted, (d) => d.t) };
}

/** How many sorted reveal times lie strictly before p (binary search) — nothing shows at p = 0. */
export function revealed(times: Float32Array, p: number): number {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] < p) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
