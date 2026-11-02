"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";

/** reducedMotion="user": motion drops transform animations for visitors who ask the OS for less motion. */
export default function Providers({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
