/**
 * Timing primitives for the reel. Everything animated on this site is a pure
 * function of a time or progress value, so any frame can be reproduced exactly
 * (the reel accepts ?t=seconds to freeze on a frame).
 */

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Local 0..1 progress of `t` inside the window [a, b]. */
export const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));

export const easeInCubic = (p: number) => p * p * p;
export const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);
export const easeInOutCubic = (p: number) =>
  p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
export const easeOutQuint = (p: number) => 1 - Math.pow(1 - p, 5);
export const easeOutBack = (p: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};
/** Settles with a damped wobble, like a ball finding the bottom of a bowl. */
export const easeOutDamped = (p: number) =>
  p >= 1 ? 1 : 1 - Math.exp(-6 * p) * Math.cos(p * Math.PI * 3.2);

/**
 * Seeded PRNG (mulberry32). Visuals that look random must be identical on the
 * server and the client, so nothing on this site calls Math.random at render.
 */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Film-style timecode HH:MM:SS:FF at 24 fps. */
export function timecode(seconds: number): string {
  const s = Math.max(0, seconds);
  const frames = Math.floor((s % 1) * 24);
  const whole = Math.floor(s);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(whole / 3600))}:${pad(Math.floor(whole / 60) % 60)}:${pad(whole % 60)}:${pad(frames)}`;
}
