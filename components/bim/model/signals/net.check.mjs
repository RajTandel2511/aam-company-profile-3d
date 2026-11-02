// Self-check for net.ts — run: node components/bim/model/signals/net.check.mjs  (Node >= 22.18 strips the types)
import assert from "node:assert/strict";
import { dashPieces, sinceArrival } from "./net.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

// straight 10 m run, 0.5 dash / 0.3 gap: 12 full dashes + a 0.4 m tail
const straight = dashPieces([[0, 0, 0], [10, 0, 0]], 0.5, 0.3);
assert.equal(straight.points.length, 26);
near(straight.drawn, 6.4);

// a corner inside a dash: the dash carries round it, starting exactly on the corner
const corner = dashPieces([[0, 0, 0], [0.3, 0, 0], [0.3, 1, 0]], 0.5, 0.3);
assert.equal(corner.points.length, 6);
near(corner.drawn, 1.0);
assert.deepEqual(corner.points[2], [0.3, 0, 0]);
near(corner.points[3][1], 0.2);

// duplicate points are skipped, never divide by zero
const dup = dashPieces([[0, 0, 0], [0, 0, 0], [0, 1, 0]], 0.5, 0.3);
near(dup.drawn, 0.7);
assert.ok(dup.points.flat().every(Number.isFinite));

// arrivals: one pulse on a 10 m loop at 5 m/s passes the 5 m mark at t = 1, 3, 5 ...
near(sinceArrival(1.0, 5, 10, 1, 5), 0);
near(sinceArrival(1.5, 5, 10, 1, 5), 0.5);
near(sinceArrival(0.5, 5, 10, 1, 5), 1.5);
near(sinceArrival(2.0, 5, 10, 2, 5), 0); // two pulses: a pass every second

// brute force against kit Pulses' placement d_i = (t·v + i·L/n) mod L
const L = 37.3, v = 11, at = 18.65, dt = 1e-3;
for (const n of [1, 2]) {
  for (let t = dt; t < 20; t += dt) {
    for (let i = 0; i < n; i++) {
      const d0 = ((t - dt) * v + (i * L) / n) % L;
      const d1 = (t * v + (i * L) / n) % L;
      if (d0 < at && d1 >= at) assert.ok(sinceArrival(t, v, L, n, at) < dt + 1e-9, `n=${n} t=${t}`);
    }
  }
}

process.stdout.write("net.check: ok\n");
