import { motionTokens } from "./motion-tokens";

/**
 * Runtime gates for animation (motion-foundations). Every check is guarded so
 * nothing touches window/navigator at module level or during server render.
 */
export const motionConfig = {
  isLowEnd(): boolean {
    if (typeof navigator === "undefined") return false;
    const cores = navigator.hardwareConcurrency ?? 8;
    // ponytail: core count + coarse pointer is a heuristic; swap for a GPU tier probe if it misjudges devices.
    const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    return cores <= 4 || (coarse && cores <= 6);
  },

  prefersReduced(): boolean {
    return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  },

  shouldAnimate({ essential = false } = {}): boolean {
    if (this.prefersReduced()) return false;
    if (!essential && this.isLowEnd()) return false;
    return true;
  },

  duration(): number {
    return this.isLowEnd() || this.prefersReduced() ? motionTokens.duration.instant : motionTokens.duration.normal;
  },
};
