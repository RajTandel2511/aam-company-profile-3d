"use client";

import { useEffect, useRef, type CSSProperties, type MouseEvent } from "react";
import { motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "motion/react";
import { animate, stagger, svg } from "animejs";
import { useWebGL2 } from "@/components/GLBoundary";
import ViewCube from "@/components/bim/ViewCube";
import { bim } from "@/components/bim/store";
import { Counter } from "@/components/ui/Counter";
import { company, contact, stats } from "@/lib/content";
import { animeTokens, motionTokens, springs } from "@/lib/motion-tokens";
import { scrollToTarget } from "@/lib/smooth-scroll";
import { useSplitReveal } from "@/lib/use-split-reveal";

const BID = `mailto:${contact.email}?subject=${encodeURIComponent("Bid request")}`;
/** CSS first-paint entrance delay (see .rise in globals.css) — runs before hydration, no JS needed. */
const at = (seconds: number) => ({ "--d": `${seconds}s` }) as CSSProperties;

/** The logo's three streams, drawn on under the headline with anime.js. */
function Streams() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lines = svg.createDrawable(el.querySelectorAll("path"));
    const anim = animate(lines, {
      draw: ["0 0", "0 1"],
      duration: animeTokens.ms(motionTokens.duration.crawl * 1.4),
      delay: stagger(animeTokens.ms(motionTokens.stagger * 2), { start: animeTokens.ms(motionTokens.duration.crawl * 1.2) }),
      ease: animeTokens.ease.sharp,
    });
    return () => {
      anim.revert();
    };
  }, []);
  return (
    <svg ref={ref} aria-hidden className="mt-6 h-auto w-[210px] md:w-[260px]" viewBox="0 0 240 32" fill="none" strokeWidth={3.5} strokeLinecap="round">
      <path d="M 3 6 C 80 2 170 4 234 12" stroke="rgb(var(--blue-rgb))" />
      <path d="M 3 15 C 80 11 170 13 234 21" stroke="rgb(var(--green-rgb))" />
      <path d="M 3 24 C 80 20 170 22 234 30" stroke="rgb(var(--red-rgb))" />
    </svg>
  );
}

/** Live readout of the load-time 4D sequence (bim.intro), updated off React; stops when it completes. */
function IntroReadout() {
  const pct = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = Math.round(bim.intro * 100);
      if (pct.current) pct.current.textContent = `${v}%`;
      if (bar.current) bar.current.style.transform = `scaleX(${bim.intro.toFixed(3)})`;
      if (bim.intro < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <>
      <span className="text-fog">Phase</span>
      <span className="flex items-center justify-between gap-3 text-chalk">
        4D sequence <span ref={pct} className="text-green-glow">0%</span>
      </span>
      <span aria-hidden className="col-span-2 mt-1 block h-px overflow-hidden bg-hair">
        <span ref={bar} className="block h-full origin-left scale-x-0 bg-green" />
      </span>
    </>
  );
}

/** The model's readout — only when there is a model to read (no WebGL, no stage). */
function ModelHud() {
  const webgl = useWebGL2();
  if (!webgl) return null;
  return (
    <div className="glass pointer-events-auto absolute right-[var(--gutter)] top-[calc(var(--nav-h)+20px)] hidden w-[300px] rounded-lg p-4 lg:block">
      <div className="flex items-start justify-between gap-4">
        <div className="hud grid flex-1 grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
          <span className="text-fog">Model</span>
          <span className="text-chalk">Typical commercial bldg</span>
          <span className="text-fog">Scale</span>
          <span className="text-chalk">Illustrative · NTS</span>
          <IntroReadout />
        </div>
        <ViewCube />
      </div>
    </div>
  );
}

function StatusBar() {
  return (
    <div className="glass absolute inset-x-0 bottom-0 border-x-0 border-b-0">
      {/* phones scroll this list sideways — focusable so keyboards can scroll it too */}
      <ul
        aria-label="Company figures"
        tabIndex={0}
        className="container-x flex snap-x gap-8 overflow-x-auto py-4 [mask-image:linear-gradient(to_right,#000_85%,transparent)] [scrollbar-width:none] md:grid md:grid-cols-5 md:gap-6 md:overflow-visible md:py-5 md:[mask-image:none]">
        {stats.map((s) => (
          <li key={s.label} className="min-w-[9.5rem] snap-start md:min-w-0">
            <p className="display text-[1.75rem] text-chalk md:text-[2.1rem]">
              <Counter to={s.value} suffix={s.suffix} />
            </p>
            <p className="hud mt-1 text-mist">{s.label}</p>
            <p className="hud mt-0.5 text-fog">{s.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Hero() {
  const section = useRef<HTMLElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end start"] });
  const fade = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const rise = useTransform(scrollYProgress, [0, 0.55], [0, -motionTokens.distance.xl]);
  // same style shape on server and client (no hydration mismatch); reduced motion zeroes the lift after mount
  const liftGain = useMotionValue(1);
  useEffect(() => liftGain.set(reduce ? 0 : 1), [reduce, liftGain]);
  const lift = useTransform([rise, liftGain], ([r, g]: number[]) => r * g);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    bim.heroTarget = v;
  });
  useEffect(() => {
    bim.heroTarget = scrollYProgress.get();
  }, [scrollYProgress]);

  useSplitReveal(title, { delay: motionTokens.duration.normal });

  const toModel = (e: MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    scrollToTarget("#systems");
  };

  return (
    // grows instead of clipping on short screens, and the copy always clears the fixed nav
    <section ref={section} id="hero" aria-labelledby="hero-title" className="relative flex min-h-[max(100svh,680px)] flex-col overflow-hidden">
      {/* legibility scrim over the model, strongest behind the copy */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden bg-[radial-gradient(130%_85%_at_0%_100%,rgb(var(--void-rgb)/0.94)_0%,rgb(var(--void-rgb)/0.6)_42%,transparent_72%)] md:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgb(var(--void-rgb)/0.96)_0%,rgb(var(--void-rgb)/0.88)_48%,transparent_68%)] md:hidden"
      />
      <ModelHud />

      <motion.div
        style={{ opacity: fade, y: lift }}
        className="container-x relative mt-auto pb-[150px] pt-[calc(var(--nav-h)+2rem)] md:pb-[170px]"
      >
        <p className="rise eyebrow text-fog" style={at(0.25)}>
          <span className="text-blue-glow">[ Est. {company.founded} ]</span> {company.short} · South San Francisco
        </p>

        <h1
          ref={title}
          id="hero-title"
          data-split
          className="display mt-5 max-w-[13ch] text-[clamp(2.6rem,min(5.6vw,9svh),5.75rem)] text-chalk"
        >
          Every system a building breathes through.
        </h1>
        <Streams />

        <p className="rise mt-6 hidden max-w-[36rem] text-[17px] leading-relaxed text-mist sm:block md:text-lg" style={at(0.9)}>
          HVAC, exhaust and outside air, EMS controls, maintenance and architectural sheet metal for Bay Area builders —
          with ductwork fabricated in our own South San Francisco shop. {company.certification}.
        </p>

        <div className="rise mt-8 flex flex-wrap items-center gap-3" style={at(1.05)}>
          <motion.a
            href="#systems"
            onClick={toModel}
            className="btn btn-primary"
            whileHover={{ y: -motionTokens.distance.xs }}
            whileTap={{ scale: motionTokens.scale.press }}
            transition={springs.snappy}
          >
            Watch it get built
            <span aria-hidden>↓</span>
          </motion.a>
          <motion.a
            href={BID}
            className="btn btn-ghost"
            whileHover={{ y: -motionTokens.distance.xs }}
            whileTap={{ scale: motionTokens.scale.press }}
            transition={springs.snappy}
          >
            Request a bid
          </motion.a>
        </div>
      </motion.div>

      <StatusBar />
    </section>
  );
}
