"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { setMotionPaused, useMotionPaused } from "@/lib/motion-pause";
import { springs } from "@/lib/motion-tokens";
import { STREAM_FILLS } from "@/components/shell/site";

const LABEL = "Pause motion";
/** Pressed: the three streams step down into a ▶. Not pressed: three level bars, a pause sign. */
const PLAY_STEPS = [1, 0.62, 0.26] as const;

type Props = {
  /** "bar": round icon button in the nav bar from lg (label beside it from xl, tooltip below that) · "sheet": labelled pill in the mobile menu */
  variant: "bar" | "sheet";
  className?: string;
};

/**
 * The site-wide "Pause motion" switch (WCAG 2.2.2): freezes every ambient loop;
 * scroll-driven motion keeps following the scroll. A toggle button: the name
 * stays "Pause motion" and aria-pressed carries the state. Hidden under reduced
 * motion, where the ambient loops are already off.
 */
export function MotionToggle({ variant, className = "" }: Props) {
  const paused = useMotionPaused();
  const [tipOff, setTipOff] = useState(false); // Escape dismisses the tooltip without moving focus (WCAG 1.4.13)
  const bar = variant === "bar";

  return (
    <button
      type="button"
      aria-label={LABEL} // exact name: the visible label is CSS-uppercased, which Chrome passes into the name
      aria-pressed={paused}
      onClick={() => setMotionPaused(!paused)}
      onKeyDown={(e) => e.key === "Escape" && setTipOff(true)}
      onBlur={() => setTipOff(false)}
      onPointerLeave={() => setTipOff(false)}
      className={`group relative shrink-0 items-center rounded-full border border-chalk/25 bg-void/40 text-mist transition-colors hover:border-chalk/60 hover:text-chalk aria-pressed:border-chalk/70 aria-pressed:bg-chalk/10 aria-pressed:text-chalk ${
        bar
          ? "hidden h-9 w-9 justify-center lg:inline-flex lg:motion-reduce:hidden xl:w-auto xl:gap-2.5 xl:px-4"
          : "inline-flex h-11 gap-3 px-5 motion-reduce:hidden"
      } ${className}`}
    >
      <Glyph paused={paused} />
      <span aria-hidden className={bar ? "hud hidden xl:inline" : "hud"}>
        {LABEL}
      </span>
      {bar && (
        // Child of the button, so moving the pointer onto it keeps it open; pt (not mt) leaves no hover gap.
        <span
          aria-hidden
          className={`invisible absolute right-0 top-full pt-2 opacity-0 transition-[opacity,visibility] group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100 xl:hidden ${
            tipOff ? "hidden" : ""
          }`}
        >
          <span className="hud block whitespace-nowrap rounded-sm border border-hair bg-panel px-2 py-1 text-chalk">{LABEL}</span>
        </span>
      )}
    </button>
  );
}

function Glyph({ paused }: { paused: boolean }) {
  return (
    <span aria-hidden className="flex h-3 shrink-0 items-center gap-[3px]">
      {STREAM_FILLS.map((fill, i) => (
        <motion.span
          key={fill}
          className={`block h-full w-[3px] rounded-full ${fill}`}
          initial={false}
          animate={{ scaleY: paused ? PLAY_STEPS[i] : 1 }}
          transition={springs.snappy}
        />
      ))}
    </span>
  );
}
