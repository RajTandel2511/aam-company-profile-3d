"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { BASE, photos } from "@/lib/content";
import { motionTokens, springs } from "@/lib/motion-tokens";
import { clamp } from "@/lib/timing";
import { Reveal } from "@/components/ui/Reveal";
import Lightbox from "./Lightbox";
import { Arrow, Plus, RoundButton, Ticks, pad, type ReelPhoto } from "./parts";

/**
 * Intrinsic pixel sizes of /public/photos (content.ts carries none).
 * ponytail: a photo missing here renders at 4:3; add its size when content.ts gains one.
 */
const SIZE: Record<string, readonly [number, number]> = {
  "/photos/rooftop-ductwork.jpg": [1200, 1600],
  "/photos/rooftop-units.jpg": [1600, 900],
  "/photos/rtu-disconnect.jpg": [1200, 1600],
  "/photos/rtu-install.jpg": [1200, 1600],
  "/photos/duct-transition.jpg": [1200, 1600],
};
const FALLBACK_SIZE = [1600, 1200] as const;

const ITEMS: ReelPhoto[] = photos.map((p) => {
  const [w, h] = SIZE[p.src] ?? FALLBACK_SIZE;
  return { ...p, url: `${BASE}${p.src}`, w, h };
});

/** The page column's left edge (.container-x: 1320px max + gutter), so frame 01 lines up with the text above. */
const COLUMN = "max(var(--gutter), calc((100% - 1320px) / 2 + var(--gutter)))";
/** Sub-pixel slack when comparing reel positions. */
const EPS = 2;

// Rest states are constant (they are the SSR markup); the *_STILL hover targets drop transforms under reduced motion.
const ZOOM: Variants = { rest: { scale: 1 }, hover: { scale: motionTokens.scale.pop } };
const ZOOM_STILL: Variants = { rest: { scale: 1 }, hover: { scale: 1 } };
const FRAME_REST = { opacity: 0.45, scale: motionTokens.scale.subtle };
const FRAME: Variants = { rest: FRAME_REST, hover: { opacity: 1, scale: 1 } };
const FRAME_STILL: Variants = { rest: FRAME_REST, hover: { ...FRAME_REST, opacity: 1 } };
const SHOW: Variants = { rest: { opacity: 0, y: motionTokens.distance.xs }, hover: { opacity: 1, y: 0 } };

/**
 * Field photos on a horizontal reel. With a fine pointer the track is a motion drag
 * (constraints from measured widths, springs.release momentum that lands on a frame
 * edge, trackpad swipes too); on touch, or under reduced motion, it is a native
 * scroll-snap strip. Prev / next buttons and arrow keys work in both. A frame opens
 * the lightbox.
 */
export default function PhotoReel() {
  const reduce = useReducedMotion();
  const [isFine, setIsFine] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [minX, setMinX] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const frames = useRef<(HTMLButtonElement | null)[]>([]);
  const opener = useRef<HTMLButtonElement | null>(null);
  const dragged = useRef(false);
  const x = useMotionValue(0);
  const seen = useMotionValue(0);
  // Both start false on server and client, so the first render is always the native strip.
  const dragMode = isFine && !reduce;

  useEffect(() => {
    setIsMounted(true);
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setIsFine(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  /** Position along the reel (px from frame 01) and how far it can travel, whichever engine moves it. */
  const where = useCallback(() => {
    const view = viewRef.current;
    const track = trackRef.current;
    if (!view || !track) return { pos: 0, max: 0, width: 0, total: 0 };
    return {
      pos: dragMode ? -x.get() : view.scrollLeft,
      max: Math.max(0, track.offsetWidth - view.clientWidth),
      width: view.clientWidth,
      total: track.offsetWidth,
    };
  }, [dragMode, x]);

  const sync = useCallback(() => {
    const { pos, max, width, total } = where();
    setAtStart(pos <= EPS);
    setAtEnd(pos >= max - EPS);
    seen.set(total ? clamp((pos + width) / total) : 1);
  }, [where, seen]);

  useMotionValueEvent(x, "change", sync);

  // Measure on every size change; reset to frame 01 whenever the engine switches.
  useEffect(() => {
    const view = viewRef.current;
    const track = trackRef.current;
    if (!view || !track) return;
    x.set(0);
    const measure = () => {
      const min = -where().max;
      setMinX(min);
      x.set(clamp(x.get(), min, 0));
      sync();
    };
    const ro = new ResizeObserver(measure);
    ro.observe(view);
    ro.observe(track);
    return () => ro.disconnect();
  }, [where, sync, x]);

  // Drag mode clips the strip, so horizontal trackpad / shift-wheel input would otherwise do nothing
  // (or swipe the browser back a page). Non-passive so it can claim the gesture.
  useEffect(() => {
    const view = viewRef.current;
    if (!dragMode || !view) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      x.stop();
      x.set(clamp(x.get() - e.deltaX, -where().max, 0));
    };
    view.addEventListener("wheel", onWheel, { passive: false });
    return () => view.removeEventListener("wheel", onWheel);
  }, [dragMode, where, x]);

  /** Each frame's distance from frame 01, in px. */
  const offsets = () => {
    const first = frames.current[0]?.offsetLeft ?? 0;
    return frames.current.map((b) => (b ? b.offsetLeft - first : 0));
  };

  const go = (target: number) => {
    const to = clamp(target, 0, where().max);
    if (dragMode) animate(x, -to, springs.release);
    else viewRef.current?.scrollTo({ left: to, behavior: reduce ? "auto" : "smooth" });
  };

  const page = (dir: 1 | -1) => {
    const { pos, max } = where();
    const o = offsets();
    const next = dir > 0 ? o.find((n) => n > pos + EPS) : [...o].reverse().find((n) => n < pos - EPS);
    go(next ?? (dir > 0 ? max : 0));
  };

  /** Momentum lands on the nearest frame edge, or on the reel's end. */
  const snap = (target: number) => {
    const want = -target;
    const best = [...offsets(), -minX].reduce((a, b) => (Math.abs(b - want) < Math.abs(a - want) ? b : a), 0);
    return -clamp(best, 0, -minX);
  };

  /** Keyboard focus on a clipped frame brings it into view (the browser cannot scroll a clipped strip). */
  const reveal = (i: number) => {
    const view = viewRef.current;
    const frame = frames.current[i];
    if (!dragMode || !view || !frame || !frame.matches(":focus-visible")) return;
    const left = frame.offsetLeft + x.get();
    if (left < 0 || left + frame.offsetWidth > view.clientWidth) go(offsets()[i] ?? 0);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLUListElement>) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    const i = frames.current.findIndex((b) => b === document.activeElement);
    if (!step || i < 0) return;
    e.preventDefault();
    frames.current[clamp(i + step, 0, ITEMS.length - 1)]?.focus();
  };

  const close = useCallback(() => {
    setOpen(null);
    opener.current?.focus();
  }, []);

  const tagTiming = reduce ? { duration: motionTokens.duration.fast } : springs.snappy;
  const zoomTiming = reduce
    ? { duration: motionTokens.duration.fast }
    : { duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth };

  return (
    <div className="relative mt-24 md:mt-32">
      <div className="container-x">
        <Reveal className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-hair pb-5">
          <div>
            <h3 className="display text-[clamp(1.75rem,3.6vw,2.75rem)] text-chalk">From the field</h3>
            <p className="hud mt-3 text-fog">Our installed work · photos from active jobs</p>
          </div>
          <div className="flex gap-2">
            <RoundButton label="Previous photo" controls="work-reel" isDisabled={atStart} onClick={() => page(-1)}>
              <Arrow dir={-1} />
            </RoundButton>
            <RoundButton label="Next photo" controls="work-reel" isDisabled={atEnd} onClick={() => page(1)}>
              <Arrow dir={1} />
            </RoundButton>
          </div>
        </Reveal>
      </div>

      <div
        ref={viewRef}
        id="work-reel"
        onScroll={dragMode ? undefined : sync}
        style={{ scrollPaddingInline: COLUMN }}
        className={`mt-8 ${
          dragMode
            ? "overflow-x-clip"
            : "snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-color:rgb(var(--hair-rgb))_transparent] [scrollbar-width:thin]"
        }`}
      >
        <motion.ul
          ref={trackRef}
          aria-label="Field photos"
          drag={dragMode ? "x" : false}
          dragConstraints={{ left: minX, right: 0 }}
          dragTransition={{
            bounceStiffness: springs.release.stiffness,
            bounceDamping: springs.release.damping,
            modifyTarget: snap,
          }}
          onPointerDownCapture={() => {
            dragged.current = false;
          }}
          onDragStart={() => {
            dragged.current = true;
          }}
          onKeyDown={onKeyDown}
          style={{ x, paddingInline: COLUMN }}
          className={`relative flex w-max gap-3 py-3 [--reel-h:clamp(260px,34vw,440px)] md:gap-5 ${
            dragMode ? "cursor-grab select-none active:cursor-grabbing" : ""
          }`}
        >
          {ITEMS.map((p, i) => (
            <li key={p.src} className="snap-start">
              <figure className="w-min">
                <motion.button
                  ref={(el) => {
                    frames.current[i] = el;
                  }}
                  type="button"
                  aria-haspopup="dialog"
                  onClick={(e) => {
                    // A drag that ends on a frame still fires a click; keyboard clicks (detail 0) always open.
                    if (dragged.current && e.detail !== 0) return;
                    opener.current = e.currentTarget;
                    setOpen(i);
                  }}
                  onFocus={() => reveal(i)}
                  initial="rest"
                  animate="rest"
                  whileHover="hover"
                  whileFocus="hover"
                  style={{ width: `calc(var(--reel-h) * ${p.w / p.h})`, height: "var(--reel-h)" }}
                  className="relative block max-w-[calc(100vw_-_2_*_var(--gutter))] overflow-hidden rounded-[4px] bg-panel"
                >
                  <span className="sr-only">Open larger view: </span>
                  <motion.span variants={reduce ? ZOOM_STILL : ZOOM} transition={zoomTiming} className="block h-full w-full">
                    <img
                      src={p.url}
                      alt={p.alt}
                      width={p.w}
                      height={p.h}
                      loading="lazy"
                      decoding="async"
                      draggable={false}
                      className="h-full w-full object-cover"
                    />
                  </motion.span>
                  <motion.span
                    aria-hidden
                    variants={reduce ? FRAME_STILL : FRAME}
                    transition={tagTiming}
                    className="absolute inset-3 text-chalk"
                  >
                    <Ticks className="inset-0" />
                  </motion.span>
                  <motion.span aria-hidden variants={SHOW} transition={tagTiming} className="bim-tag absolute bottom-3 right-3">
                    View <Plus />
                  </motion.span>
                </motion.button>
                <figcaption className="hud mt-3 flex gap-3 text-fog">
                  <span className="shrink-0 text-mist">Fig. {pad(i + 1)}</span>
                  <span>{p.project}</span>
                </figcaption>
              </figure>
            </li>
          ))}
        </motion.ul>
      </div>

      <div className="container-x mt-5">
        <div aria-hidden className="relative h-px overflow-hidden bg-hair">
          <motion.div className="absolute inset-0 origin-left bg-chalk/60" style={{ scaleX: seen }} />
        </div>
      </div>

      {isMounted &&
        createPortal(
          <AnimatePresence>
            {open !== null && <Lightbox key="work-lightbox" photos={ITEMS} start={open} onClose={close} />}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
