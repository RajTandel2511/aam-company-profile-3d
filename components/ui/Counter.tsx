"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { motionTokens } from "@/lib/motion-tokens";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type Props = { to: number; suffix?: string; className?: string };

/**
 * Counts up from 0 the first time it scrolls into view. The server renders the
 * final value (correct without JS); reduced motion shows it immediately.
 * Screen readers always get the final figure from the sr-only copy — the
 * animated digits are hidden from them.
 */
export function Counter({ to, suffix = "", className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();

  useIsoLayoutEffect(() => {
    if (ref.current && !reduce) ref.current.textContent = `0${suffix}`;
  }, [reduce, suffix]);

  useEffect(() => {
    const node = ref.current;
    if (!node || !inView) return;
    if (reduce) {
      node.textContent = `${to}${suffix}`;
      return;
    }
    const controls = animate(0, to, {
      duration: motionTokens.duration.crawl * 2,
      ease: motionTokens.easing.smooth,
      onUpdate: (v) => {
        node.textContent = `${Math.round(v)}${suffix}`;
      },
    });
    return () => controls.stop();
  }, [inView, to, suffix, reduce]);

  return (
    <span className={className}>
      <span ref={ref} aria-hidden>{`${to}${suffix}`}</span>
      <span className="sr-only">{`${to}${suffix}`}</span>
    </span>
  );
}
