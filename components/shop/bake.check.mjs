// Checks the fitting bake on a small scene. Run: node components/shop/bake.check.mjs
import assert from "node:assert/strict";
import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { bake } from "./bake.ts";

const steel = new THREE.MeshStandardMaterial();
const zinc = new THREE.MeshStandardMaterial();
const glow = new THREE.MeshBasicMaterial();
const lines = new LineMaterial();

/** Like <Plate>: a box, with an <Edges>-style LineSegments2 child unless bare. */
function plate(parent, size, position, material = steel, edged = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  if (edged) mesh.add(new LineSegments2());
  parent.add(mesh);
  return mesh;
}

/** Every vertex of `mesh` in world space, as a box. */
function worldBox(mesh) {
  mesh.updateWorldMatrix(true, false);
  const box = new THREE.Box3();
  const pos = mesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) box.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld));
  return box;
}

/** Baked positions are stored as float32: equal to a micrometre is equal (a wrong transform is off by centimetres). */
const same = (p, q) => p.min.distanceTo(q.min) < 1e-6 && p.max.distanceTo(q.max) < 1e-6;

// A fitting moved, turned and scaled in the world; its parts sit in a live group with no transform.
const fitting = new THREE.Group();
fitting.position.set(2, -1, 3);
fitting.rotation.set(0.4, -0.9, 0.2);
fitting.scale.setScalar(1.5);
const live = new THREE.Group();
fitting.add(live);

const a = plate(live, [1, 0.1, 0.5], [0.5, 0, 0]);
const mirror = new THREE.Group(); // mirrored, like Panel's -x flange strips
mirror.scale.set(-1, 1, 1);
mirror.position.set(-0.6, 0.2, 0);
live.add(mirror);
const b = plate(mirror, [0.2, 0.3, 0.4], [0.3, 0, 0.1]);
const bolt = plate(live, [0.1, 0.1, 0.1], [0, 1, 0], zinc, false); // bolts carry no edge lines
plate(live, [9, 9, 9], [0, 0, 0], glow); // a glow keeps its own material: stays live
plate(live, [9, 9, 9], [0, 0, 0]).visible = false; // hidden parts are left out

const want = { steel: worldBox(a).union(worldBox(b)), zinc: worldBox(bolt) };
const baked = bake(live, new Set([steel, zinc]), lines);
fitting.add(baked); // where useBake puts it: beside the live group

const meshes = baked.children.filter((o) => o.isMesh && !o.isLineSegments2);
assert.equal(meshes.length, 2, "one mesh per kit material, glow and hidden part left out");
const steelMesh = meshes.find((o) => o.material === steel);
const zincMesh = meshes.find((o) => o.material === zinc);
assert.equal(steelMesh.geometry.attributes.position.count, 2 * 36, "two boxes, non-indexed");
assert.equal(zincMesh.geometry.attributes.position.count, 36);
assert.ok(same(worldBox(steelMesh), want.steel), "steel lands where the live plates were");
assert.ok(same(worldBox(zincMesh), want.zinc), "zinc lands where the live bolt was");
assert.ok(a.geometry.index !== null && b.geometry.attributes.uv, "live geometry untouched");

// Every triangle must face the way its normal points, mirrored plate included.
const pos = steelMesh.geometry.attributes.position;
const nrm = steelMesh.geometry.attributes.normal;
const [p0, p1, p2, n] = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
for (let i = 0; i < pos.count; i += 3) {
  p0.fromBufferAttribute(pos, i);
  p1.fromBufferAttribute(pos, i + 1).sub(p0);
  p2.fromBufferAttribute(pos, i + 2).sub(p0);
  assert.ok(p1.cross(p2).dot(n.fromBufferAttribute(nrm, i)) > 0, `triangle ${i / 3} faces inward`);
}

const edges = baked.children.find((o) => o.isLineSegments2);
assert.equal(edges.material, lines);
assert.equal(edges.geometry.attributes.instanceStart.count, 2 * 12, "12 edges per edged plate, none for the bolt");
steelMesh.geometry.computeBoundingBox();
assert.ok(same(edges.geometry.boundingBox, steelMesh.geometry.boundingBox), "edges trace the plates");

console.log("bake: ok");
