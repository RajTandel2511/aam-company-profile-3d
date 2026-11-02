// Self-check for the RectDuct planner. Run: node components/bim/model/air/plan.check.mjs
import assert from "node:assert/strict";
import { FLANGE, extendEnd, fraction, grow, planRun, trimStart } from "./plan.ts";

const near = (a, b, what) => assert.ok(Math.abs(a - b) < 1e-9, `${what}: ${a} vs ${b}`);

// An L-shaped main, 0.9 x 0.5: 4 m south, then 10 m east.
const main = planRun([[0, 3, 0], [0, 3, 4], [10, 3, 4]], [0.9, 0.5]);
const [bodyA, elbow, bodyB] = main.pieces;
near(main.total, 14, "centreline length");

// Square elbow 0.9 (x) x 0.5 (y) x 0.9 (z); bodies abut it exactly — no overlap, no z-fighting.
assert.deepEqual(elbow.s, [0.9, 0.5, 0.9]);
assert.deepEqual([bodyA.s[0], bodyA.s[1]], [0.9, 0.5], "south run: w across (x), h tall (y)");
assert.deepEqual([bodyB.s[1], bodyB.s[2]], [0.5, 0.9], "east run: h tall (y), w across (z)");
near(bodyA.c[2] + bodyA.s[2] / 2, elbow.c[2] - elbow.s[2] / 2, "body A meets the elbow");
near(elbow.c[0] + elbow.s[0] / 2, bodyB.c[0] - bodyB.s[0] / 2, "elbow meets body B");

// Growth spans tile the path from 0 to the end, in order.
near(bodyA.from, 0, "starts at the first point");
near(bodyA.to, elbow.from, "A hands over to the elbow");
near(elbow.to, bodyB.from, "elbow hands over to B");
near(bodyB.to, main.total, "ends at the last point");

// Half-built body A has grown from its start face, half its length.
const c = [0, 0, 0];
const s = [0, 0, 0];
grow(bodyA, fraction(bodyA, bodyA.from + (bodyA.to - bodyA.from) / 2), c, s);
near(s[2], bodyA.s[2] / 2, "half length");
near(c[2] - s[2] / 2, 0, "anchored at the start face");

// Flanges: start (prouder), every 1.5 m, one either side of the elbow, none crowding an end.
const flanges = main.pieces.filter((p) => !p.head);
assert.equal(flanges.length, 3 + 7, "A: 0, 1.5, elbow face; B: 0..9.0 every 1.5");
near(flanges[0].s[0], 0.9 + 2 * FLANGE.proudStart, "body-start flange stands prouder");
near(flanges[1].s[0], 0.9 + 2 * FLANGE.proud, "running flange");
assert.ok(flanges.every((f) => f.from === f.to), "flanges appear whole");

// Vertical section is w along x by h along z; short necks carry no flanges.
const neck = planRun([[0, 3, 0], [0, 2.7, 0]], [0.3, 0.2]);
assert.deepEqual([neck.pieces[0].s[0], neck.pieces[0].s[2]], [0.3, 0.2]);
assert.equal(neck.pieces.length, 1, "a 0.3 m neck is one body");

assert.throws(() => planRun([[0, 0, 0], [1, 1, 0]], [1, 1]), /axis-aligned/);
assert.deepEqual(trimStart([[0, 0, 0], [0, 0, 5]], 1), [[0, 0, 1], [0, 0, 5]]);
assert.deepEqual(trimStart([[0, 0, 0], [0, 0, 5]], -1), [[0, 0, -1], [0, 0, 5]]);
assert.deepEqual(extendEnd([[0, 0, 0], [0, 0, 5]], 1), [[0, 0, 0], [0, 0, 6]]);

console.log("plan.check: ok");
