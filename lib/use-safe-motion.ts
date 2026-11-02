"use client";

import { useReducedMotion } from "motion/react";
import { motionTokens } from "./motion-tokens";

/**
 * Enter/exit props that drop every transform under reduced motion — opacity
 * fades only, capped at the fast duration (motion-foundations rule 3).
 */
export function useSafeMotion(fullY: number = motionTokens.distance.md) {
  const reduce = useReducedMotion() ?? false;
  return {
    reduce,
    initial: { opacity: 0, y: reduce ? 0 : fullY },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reduce ? 0 : -fullY },
    transition: reduce
      ? { duration: motionTokens.duration.fast }
      : { duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth },
  };
}
