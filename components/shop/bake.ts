import * as THREE from "three";
import type { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Baking a finished fitting into a few draw calls. Pure three.js (no React), so
 * bake.check.mjs runs it in Node: `node components/shop/bake.check.mjs`.
 */

/** drei <Edges>' default crease angle, degrees. */
const CREASE = 15;

/** A mirrored part comes out inside-out once its transform is baked in: swap each triangle's last two vertices. */
function flipWinding(g: THREE.BufferGeometry) {
  for (const name in g.attributes) {
    const { array, itemSize, count } = g.attributes[name] as THREE.BufferAttribute;
    for (let v = 0; v < count; v += 3) {
      for (let k = 0; k < itemSize; k++) {
        const a = (v + 1) * itemSize + k;
        const b = (v + 2) * itemSize + k;
        const t = array[a];
        array[a] = array[b];
        array[b] = t;
      }
    }
  }
}

/**
 * The visible meshes under `root` drawn with one of `bakes`, merged into one mesh per
 * material, plus the edge lines of those carrying a drei <Edges> (a LineSegments2 child)
 * merged into one LineSegments2 — all in root's own frame. Anything else (glows, ghosts,
 * lines, hidden parts) is left out.
 */
export function bake(root: THREE.Object3D, bakes: ReadonlySet<THREE.Material>, edgeMaterial: LineMaterial): THREE.Group {
  root.updateWorldMatrix(true, true);
  const toRoot = root.matrixWorld.clone().invert();
  const m = new THREE.Matrix4();
  const parts = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const edges: number[] = [];
  root.traverseVisible((o) => {
    const mesh = o as THREE.Mesh;
    const mat = mesh.material as THREE.Material;
    if (!mesh.isMesh || !bakes.has(mat)) return;
    m.multiplyMatrices(toRoot, mesh.matrixWorld);
    const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    g.deleteAttribute("uv"); // untextured; dropping it lets boxes, extrusions and the transition merge
    g.applyMatrix4(m);
    if (m.determinant() < 0) flipWinding(g);
    const list = parts.get(mat) ?? [];
    list.push(g);
    parts.set(mat, list);
    if (mesh.children.some((c) => (c as LineSegments2).isLineSegments2)) {
      const e = new THREE.EdgesGeometry(mesh.geometry, CREASE).applyMatrix4(m);
      const pos = e.attributes.position.array;
      for (let i = 0; i < pos.length; i++) edges.push(pos[i]);
      e.dispose();
    }
  });
  const out = new THREE.Group();
  parts.forEach((list, mat) => {
    const merged = mergeGeometries(list);
    list.forEach((g) => g.dispose());
    if (merged) out.add(new THREE.Mesh(merged, mat));
  });
  if (edges.length > 0) out.add(new LineSegments2(new LineSegmentsGeometry().setPositions(edges), edgeMaterial));
  return out;
}
