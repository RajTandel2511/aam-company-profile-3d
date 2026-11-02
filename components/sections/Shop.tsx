"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  type MotionValue,
  type Variants,
} from "motion/react";
import { GLBoundary, useWebGL2 } from "@/components/GLBoundary";
import { services } from "@/lib/content";
import { motionTokens, springs } from "@/lib/motion-tokens";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { PIECES, SEQUENCE_LABEL, SPECS, STEPS, stepAt } from "@/components/shop/sequence";

/** three.js / R3F stay out of the server bundle: the canvas loads on the client only. */
const ShopStage = dynamic(() => import("@/components/shop/ShopStage"), {
  ssr: false,
  loading: () => <p className="hud absolute inset-0 grid place-items-center text-fog">Loading model</p>,
});

const fab = services.find((s) => s.id === "fabrication");
/** The logo's three streams, as list bullets. */
const STREAMS = ["bg-blue", "bg-green", "bg-red"] as const;
const num = (i: number) => String(i + 1).padStart(2, "0");
const TOTAL = num(STEPS.length - 1);

/**
 * In-house fabrication: a pinned, scroll-scrubbed 3D sequence of how the shop makes
 * rectangular duct, with the steps beside it (desktop) or under it (mobile).
 * Layout switches on the prefers-reduced-motion media query in CSS, so server and
 * client markup always match: reduced motion gets no pin, the finished run drawn
 * once, and the steps as a plain list.
 */
export default function Shop() {
  const track = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: track, offset: ["start start", "end end"] });
  // critically damped: tracks the (already Lenis-smoothed) scroll without overshooting a step boundary
  const progress = useSpring(scrollYProgress, springs.follow);
  const webgl = useWebGL2();
  const [active, setActive] = useState(0);
  useMotionValueEvent(progress, "change", (v) => setActive(stepAt(v)));

  if (!fab) return null;

  const fade = reduce
    ? { duration: motionTokens.duration.fast }
    : { duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth };
  const chip: Variants = {
    hidden: { opacity: 0, y: motionTokens.distance.sm },
    visible: { opacity: 1, y: 0, transition: fade },
  };

  return (
    <section id="shop" aria-labelledby="shop-title" className="relative bg-void">
      <div className="container-x grid gap-10 pt-28 md:pt-36 lg:grid-cols-12 lg:items-end lg:gap-16">
        <SectionHeader
          className="lg:col-span-8"
          id="shop-title"
          index="02"
          kicker="Shop · In-house fabrication"
          title="Fabricated in our own shop."
          intro={fab.body}
        />
        <Reveal className="lg:col-span-4" delay={motionTokens.duration.normal}>
          <p className="hud text-fog">{fab.title}</p>
          <ul className="mt-3 border-t border-hair">
            {fab.items.map((item, i) => (
              <li key={item} className="flex items-center gap-3 border-b border-hair py-3 text-[15px] font-semibold text-chalk">
                <span aria-hidden className={`h-[3px] w-6 shrink-0 rounded-full ${STREAMS[i % STREAMS.length]}`} />
                {item}
              </li>
            ))}
          </ul>
        </Reveal>
      </div>

      {/* The pinned sequence: a tall track with a sticky viewport inside it. On desktop the
          grid's one row is held to the sticky box, so the canvas and its HUD never run below the fold. */}
      <div ref={track} className="relative mt-14 md:mt-20 motion-safe:h-[320vh]">
        <div className="motion-safe:sticky motion-safe:top-[var(--nav-h)] motion-safe:h-[calc(100svh_-_var(--nav-h))]">
          <div className="container-x flex h-full flex-col gap-5 py-4 lg:grid lg:grid-cols-12 lg:grid-rows-[minmax(0,1fr)] lg:gap-10 lg:py-8">
            <div
              role="img"
              aria-label={SEQUENCE_LABEL}
              className="relative isolate order-first shrink-0 overflow-hidden rounded-md border border-hair bg-deep motion-safe:h-[58%] motion-reduce:h-[62vh] lg:order-none lg:col-span-8 lg:col-start-5 lg:row-start-1 lg:motion-safe:h-full"
            >
              {webgl && (
                <GLBoundary>
                  <ShopStage progress={progress} />
                </GLBoundary>
              )}
              <ViewportHud active={active} progress={progress} />
            </div>
            <div className="lg:col-span-4 lg:col-start-1 lg:row-start-1 lg:self-center">
              <p className="hud text-fog">
                <span className="motion-reduce:hidden">Sequence · scroll to build</span>
                <span className="hidden motion-reduce:inline">Sequence</span>
              </p>
              <StepList active={active} />
              <StepReadout active={active} />
              <MobileStep active={active} />
            </div>
          </div>
        </div>
      </div>

      <div className="container-x grid gap-12 pb-28 pt-16 md:pb-36 md:pt-24 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-5">
          <div className="glass rounded-md">
            <p className="hud flex items-center justify-between border-b border-hair px-4 py-3 text-fog">
              <span>Properties</span>
              <span className="text-blue-glow">Shop standard</span>
            </p>
            <dl>
              {SPECS.map((s) => (
                <div key={s.k} className="grid grid-cols-[8.5rem_1fr] gap-4 border-b border-hair/70 px-4 py-3.5 last:border-b-0">
                  <dt className="hud pt-[3px] text-fog">{s.k}</dt>
                  <dd className="text-[14px] leading-snug text-chalk">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>
        <div className="lg:col-span-7">
          <h3 className="eyebrow text-fog">Typical pieces</h3>
          <motion.ul
            className="mt-5 flex flex-wrap gap-2"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={{ visible: { transition: { staggerChildren: reduce ? 0 : motionTokens.stagger } } }}
          >
            {PIECES.map((piece, i) => (
              <motion.li
                key={piece}
                data-reveal
                variants={chip}
                className="mono inline-flex items-center gap-2.5 rounded-[3px] border border-chalk/15 bg-panel/70 px-3 py-2 text-[12px] uppercase tracking-[0.1em] text-chalk"
              >
                <span className="text-blue-glow">{num(i)}</span>
                {piece}
              </motion.li>
            ))}
          </motion.ul>
          <p className="mt-6 max-w-md text-[14px] leading-relaxed text-fog">The shop builds rectangular duct only.</p>
        </div>
      </div>
    </section>
  );
}

/**
 * The step rail: desktop, and the reduced-motion list on every width; on mobile it stays
 * in the accessibility tree only. Desktop shows one line per step — every title, the
 * current one lit — with its text in StepReadout, so all seven fit the pinned box on a
 * laptop. Reduced motion lists every step's text. Inactive titles step down a colour
 * tier rather than fading, so every line keeps AA contrast; the indicator carries the motion.
 */
function StepList({ active }: { active: number }) {
  return (
    <ol className="sr-only mt-5 lg:not-sr-only motion-reduce:not-sr-only">
      {STEPS.map((s, i) => {
        const isActive = i === active;
        return (
          <li key={s.id} className="relative flex items-baseline gap-3 py-2.5 pl-6 lg:motion-safe:py-2">
            <span aria-hidden className="absolute inset-y-1.5 left-0 w-px bg-hair" />
            {isActive && (
              <motion.span
                layoutId="shop-step"
                aria-hidden
                className="absolute inset-y-1.5 left-0 w-[2px] bg-blue-glow motion-reduce:hidden"
                transition={springs.snappy}
              />
            )}
            <span aria-hidden className={`hud w-6 shrink-0 text-fog ${isActive ? "motion-safe:text-blue-glow" : ""}`}>
              {num(i)}
            </span>
            <div>
              <h3 className={`text-[16px] font-bold leading-tight text-chalk ${isActive ? "" : "motion-safe:text-mist"}`}>{s.title}</h3>
              {/* with motion the readout shows this visually; it stays here for screen readers */}
              <p className="mt-1 text-[14px] leading-snug text-mist motion-safe:sr-only">{s.line}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Readout swap: the old line clears quickly, the new one settles in just behind it. */
const LINE_IN = {
  opacity: 1,
  y: 0,
  transition: { duration: motionTokens.duration.normal, delay: motionTokens.duration.instant, ease: motionTokens.easing.smooth },
};
const LINE_OUT = {
  opacity: 0,
  y: -motionTokens.distance.xs,
  transition: { duration: motionTokens.duration.fast, ease: motionTokens.easing.smooth },
};

/**
 * Desktop: the current step's text under the rail. Every line shares one grid cell, so
 * the readout is always as tall as the longest and nothing reflows as the steps change.
 * A visual duplicate of the list, so hidden from assistive tech.
 */
function StepReadout({ active }: { active: number }) {
  return (
    <div aria-hidden className="mt-5 hidden border-t border-hair pt-4 lg:motion-safe:grid">
      {STEPS.map((s, i) => (
        <motion.p
          key={s.id}
          className="col-start-1 row-start-1 text-[14px] leading-snug text-mist"
          initial={false}
          animate={i === active ? LINE_IN : LINE_OUT}
        >
          {s.line}
        </motion.p>
      ))}
    </div>
  );
}

/** Mobile: the active step under the canvas. A visual duplicate of the list, so hidden from assistive tech. */
function MobileStep({ active }: { active: number }) {
  const step = STEPS[active];
  return (
    <div aria-hidden className="mt-3 lg:hidden motion-reduce:hidden">
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <span key={s.id} className={`h-[2px] flex-1 ${i <= active ? "bg-blue-glow" : "bg-hair"}`} />
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={step.id}
          className="mt-4"
          initial={{ opacity: 0, y: motionTokens.distance.sm }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -motionTokens.distance.sm }}
          transition={{ duration: motionTokens.duration.fast, ease: motionTokens.easing.smooth }}
        >
          <p className="hud text-fog">
            <span className="text-blue-glow">{num(active)}</span> / {TOTAL}
          </p>
          <p className="mt-1 text-[17px] font-bold leading-tight text-chalk">{step.title}</p>
          <p className="mt-1 text-[14px] leading-snug text-mist">{step.line}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Viewport chrome over the canvas: crop marks, a label, a scrubbed progress hairline. */
function ViewportHud({ active, progress }: { active: number; progress: MotionValue<number> }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-30">
      <span className="absolute left-2 top-2 h-3 w-3 border-l border-t border-chalk/40" />
      <span className="absolute right-2 top-2 h-3 w-3 border-r border-t border-chalk/40" />
      <span className="absolute bottom-2 left-2 h-3 w-3 border-b border-l border-chalk/40" />
      <span className="absolute bottom-2 right-2 h-3 w-3 border-b border-r border-chalk/40" />
      <p className="hud absolute left-5 top-4 text-fog">Shop sequence</p>
      <p className="hud absolute right-5 top-4 hidden text-fog sm:block">24 × 12 in duct · illustrative</p>
      <div className="absolute inset-x-5 bottom-4 flex items-center gap-3 motion-reduce:hidden">
        <span className="hud text-blue-glow">{num(active)}</span>
        <span className="relative h-px flex-1 overflow-hidden bg-hair">
          <motion.span className="absolute inset-0 origin-left bg-blue-glow" style={{ scaleX: progress }} />
        </span>
        <span className="hud text-fog">{TOTAL}</span>
      </div>
    </div>
  );
}
