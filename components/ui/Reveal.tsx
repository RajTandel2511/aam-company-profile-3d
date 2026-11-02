"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { motionTokens } from "@/lib/motion-tokens";

type Props = { children: ReactNode; className?: string; delay?: number; y?: number };

/**
 * Fades and rises once when scrolled into view. `initial` is constant so server
 * and client render the same markup; MotionConfig reducedMotion="user" drops the
 * rise for reduced-motion visitors, and their fade is cut to the fast duration.
 * data-reveal lets the <noscript> rule in layout show it without JS.
 */
export function Reveal({ children, className, delay = 0, y = motionTokens.distance.lg }: Props) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      data-reveal
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={
        reduce
          ? { duration: motionTokens.duration.fast }
          : { duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth, delay }
      }
    >
      {children}
    </motion.div>
  );
}
