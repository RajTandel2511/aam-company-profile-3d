"use client";

import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "motion/react";
import { equipmentBrands } from "@/lib/content";
import { motionTokens } from "@/lib/motion-tokens";
import { PauseGlyph, PlayGlyph } from "./parts";

/** A slow, readable drift: one xl distance per crawl duration (48 px/s). */
const SPEED = motionTokens.distance.xl / motionTokens.duration.crawl;

/** Brand NAMES as plain text — never logos. Each item carries its trailing separator so the copies tile seamlessly. */
const brandItems = equipmentBrands.map((b) => (
  <li key={b} className="flex items-center">
    <span className="display whitespace-nowrap px-6 text-[clamp(1.35rem,2.6vw,2rem)] text-mist md:px-8">{b}</span>
    <span aria-hidden className="h-1.5 w-1.5 rotate-45 border border-fog" />
  </li>
));

/**
 * "We install equipment from" + a marquee of the brand names. Pauses on hover, on focus,
 * off-screen and in a hidden tab; has a real pause button (WCAG 2.2.2); under reduced
 * motion it never starts and CSS lays the names out as a static wrapped list.
 */
export default function BrandMarquee() {
  const reduce = useReducedMotion();
  const viewRef = useRef<HTMLDivElement>(null);
  const copyRef = useRef<HTMLUListElement>(null);
  const loop = useRef<AnimationPlaybackControls | null>(null);
  const runningRef = useRef(false);
  const x = useMotionValue(0);
  const inView = useInView(viewRef);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const running = !reduce && inView && !isHovered && !isFocused && !isPaused && !isTabHidden;

  // One loop = the measured width of one copy. Rebuilt, phase kept, when a font swap or resize changes it.
  useEffect(() => {
    const copy = copyRef.current;
    if (!copy || reduce) return;
    const build = () => {
      const width = copy.offsetWidth;
      if (!width) return;
      loop.current?.stop();
      const from = x.get() % width;
      loop.current = animate(x, [from, from - width], {
        duration: width / SPEED,
        ease: motionTokens.easing.linear,
        repeat: Infinity,
      });
      if (!runningRef.current) loop.current.pause();
    };
    const ro = new ResizeObserver(build);
    ro.observe(copy);
    return () => {
      ro.disconnect();
      loop.current?.stop();
      loop.current = null;
      x.set(0);
    };
  }, [reduce, x]);

  // ponytail: hard pause/play. Easing `speed` to 0 would be nicer, but motion's play() rebases time
  // as if speed were 1, so resuming from 0 jumps the loop to its start.
  useEffect(() => {
    runningRef.current = running;
    if (running) loop.current?.play();
    else loop.current?.pause();
  }, [running]);

  useEffect(() => {
    const onVisibility = () => setIsTabHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return (
    <div
      className="flex flex-col gap-4 border-y border-hair py-6 md:flex-row md:items-center md:gap-8"
      onFocus={() => setIsFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setIsFocused(false);
      }}
    >
      <p className="eyebrow shrink-0 text-fog">We install equipment from</p>
      <div
        ref={viewRef}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
        className="relative min-w-0 flex-1 overflow-x-clip [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)] motion-reduce:[mask-image:none]"
      >
        <motion.div style={{ x }} className="flex w-max motion-reduce:w-auto">
          <ul ref={copyRef} aria-label="Equipment brands" className="flex shrink-0 items-center motion-reduce:shrink motion-reduce:flex-wrap">
            {brandItems}
          </ul>
          <ul aria-hidden className="flex shrink-0 items-center motion-reduce:hidden">
            {brandItems}
          </ul>
        </motion.div>
      </div>
      <button
        type="button"
        onClick={() => setIsPaused((p) => !p)}
        aria-label={isPaused ? "Play the equipment brand ticker" : "Pause the equipment brand ticker"}
        className="hud inline-flex h-9 shrink-0 items-center gap-2 self-start rounded-full border border-hair px-3.5 text-mist transition-colors hover:border-chalk/40 hover:text-chalk md:self-auto motion-reduce:hidden"
      >
        {isPaused ? <PlayGlyph /> : <PauseGlyph />}
        <span aria-hidden>{isPaused ? "Play" : "Pause"}</span>
      </button>
    </div>
  );
}
