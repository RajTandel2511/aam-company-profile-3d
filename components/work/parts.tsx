"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { motionTokens, springs } from "@/lib/motion-tokens";

/** A field photo prepared for the reel and the lightbox: content.ts facts + the served URL and pixel size. */
export type ReelPhoto = { src: string; url: string; alt: string; project: string; w: number; h: number };

/** Two-digit readout, BIM-schedule style: 7 -> "07". */
export const pad = (n: number) => String(n).padStart(2, "0");

/** Viewport crop marks: four L-ticks in the corners of a positioned parent. Colour follows currentColor. */
export function Ticks({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute ${className}`}>
      <span className="absolute left-0 top-0 h-3 w-3 border-l border-t border-current" />
      <span className="absolute right-0 top-0 h-3 w-3 border-r border-t border-current" />
      <span className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-current" />
      <span className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-current" />
    </span>
  );
}

const ICON = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  "aria-hidden": true,
} as const;

export const Arrow = ({ dir }: { dir: 1 | -1 }) => (
  <svg {...ICON} className={dir < 0 ? "-scale-x-100" : undefined}>
    <path d="M2 8h11M9 4l4 4-4 4" strokeLinecap="square" />
  </svg>
);
export const Plus = () => (
  <svg {...ICON} width={12} height={12}>
    <path d="M8 2.5v11M2.5 8h11" />
  </svg>
);
export const Cross = () => (
  <svg {...ICON} width={14} height={14}>
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
  </svg>
);
export const PauseGlyph = () => (
  <svg {...ICON} width={12} height={12}>
    <path d="M5 3v10M11 3v10" strokeWidth={2} />
  </svg>
);
export const PlayGlyph = () => (
  <svg {...ICON} width={12} height={12} fill="currentColor" stroke="none">
    <path d="M4.5 2.5l9 5.5-9 5.5z" />
  </svg>
);

type RoundButtonProps = {
  label: string;
  onClick: () => void;
  isDisabled?: boolean;
  controls?: string;
  children: ReactNode;
};

/**
 * Round hairline icon button. Uses aria-disabled rather than disabled so a focused
 * button reaching the end of the reel keeps focus instead of dropping it to <body>.
 */
export function RoundButton({ label, onClick, isDisabled = false, controls, children }: RoundButtonProps) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-controls={controls}
      aria-disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      whileTap={isDisabled || reduce ? undefined : { scale: motionTokens.scale.press }}
      transition={springs.snappy}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-hair bg-void/40 text-chalk transition-colors hover:border-chalk/50 hover:bg-chalk/5 aria-disabled:cursor-not-allowed aria-disabled:opacity-35 aria-disabled:hover:border-hair aria-disabled:hover:bg-void/40"
    >
      {children}
    </motion.button>
  );
}
