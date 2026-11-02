import type { V3 } from "../../geometry";

/**
 * Pure helpers for the controls network (no runtime imports, so `net.check.mjs`
 * can run them under plain Node).
 */

export type Dashes = { points: V3[]; drawn: number };

/**
 * Split a polyline into dash pieces for a drei `<Line segments>`: [a0, a1, b0, b1, ...].
 * The pattern runs on continuously round corners. `drawn` is the summed dash length —
 * exactly the distance LineSegments2 accumulates — so a fraction t draws on with
 * `material.dashSize = drawn * t` (and a gapSize longer than the route).
 */
export function dashPieces(pts: readonly V3[], dash: number, gap: number): Dashes {
  const period = dash + gap;
  const points: V3[] = [];
  let drawn = 0;
  let s0 = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (len < 1e-6) continue;
    const at = (s: number): V3 => {
      const t = (s - s0) / len;
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    };
    // dash j covers [j·period, j·period + dash] of the whole polyline
    for (let j = Math.floor(s0 / period); j * period < s0 + len; j++) {
      const lo = Math.max(s0, j * period);
      const hi = Math.min(s0 + len, j * period + dash);
      if (hi - lo < 1e-4) continue;
      points.push(at(lo), at(hi));
      drawn += hi - lo;
    }
    s0 += len;
  }
  return { points, drawn };
}

/**
 * Seconds since a pulse last passed distance `at` on a looping path. Mirrors kit
 * Pulses, which puts dot i at (time·speed + i·loop/n) mod loop — so passes at `at`
 * repeat every loop/n metres. Drives the LED blink when data reaches a device.
 */
export function sinceArrival(time: number, speed: number, loop: number, n: number, at: number): number {
  const every = loop / n;
  return ((((time * speed - at) % every) + every) % every) / speed;
}
