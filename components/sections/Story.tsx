"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import ViewCube from "@/components/bim/ViewCube";
import { bim } from "@/components/bim/store";
import { CHAPTERS, STORY, chapterAt, type ChapterId } from "@/components/bim/timeline";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { contact, services, type ServiceId } from "@/lib/content";
import { motionTokens } from "@/lib/motion-tokens";
import { useSplitReveal } from "@/lib/use-split-reveal";

type Tone = "steel" | "blue" | "green" | "signal" | "chalk";

const TONE: Record<Tone, { text: string; fill: string }> = {
  steel: { text: "text-mist", fill: "bg-silver" },
  blue: { text: "text-blue-glow", fill: "bg-blue" },
  green: { text: "text-green-glow", fill: "bg-green" },
  signal: { text: "text-chalk", fill: "bg-signal" },
  chalk: { text: "text-chalk", fill: "bg-chalk" },
};

type Trade = { id: ServiceId & ChapterId; tone: Tone; category: string; doneAt: number; done: string; doing: string };

/** The five trades in build order — chapter ids match content.services ids. */
const TRADES: Trade[] = [
  { id: "sheetmetal", tone: "steel", category: "Architectural · Envelope", doneAt: STORY.sheetmetal.glint[1], doing: "Installing", done: "Installed" },
  { id: "hvac", tone: "blue", category: "Mechanical · Supply / Return", doneAt: STORY.hvac.run, doing: "Installing", done: "Running" },
  { id: "exhaust", tone: "green", category: "Mechanical · Exhaust / OA", doneAt: STORY.exhaust.run, doing: "Installing", done: "Running" },
  { id: "controls", tone: "signal", category: "Controls · EMS network", doneAt: STORY.controls.run, doing: "Commissioning", done: "Online" },
  { id: "maintenance", tone: "chalk", category: "Service · Preventative", doneAt: STORY.maintenance.stops[2][1], doing: "Inspecting", done: "PM complete" },
];

const serviceOf = (id: ServiceId) => {
  const s = services.find((x) => x.id === id);
  if (!s) throw new Error(`content.services is missing "${id}"`);
  return s;
};

const LEGEND = [
  { label: "Arch. sheet metal", swatch: "bg-silver", from: 1 },
  { label: "Supply air", swatch: "bg-blue", from: 2 },
  { label: "Return air", swatch: "bg-red", from: 2 },
  { label: "Exhaust · outside air", swatch: "bg-green", from: 3 },
  { label: "EMS / controls", swatch: "dashed", from: 4 },
  { label: "Preventative maintenance", swatch: "ring", from: 5 },
] as const;

const BID = `mailto:${contact.email}?subject=${encodeURIComponent("Bid request")}`;

/* ------------------------------------------------------------------ parts -- */

function Rail({ p, active }: { p: MotionValue<number>; active: number }) {
  return (
    <ol className="grid grid-cols-5 gap-2" aria-label="Systems in this model">
      {TRADES.map((t, i) => (
        <RailStep key={t.id} p={p} index={i} trade={t} on={active === i + 1} />
      ))}
    </ol>
  );
}

function RailStep({ p, index, trade, on }: { p: MotionValue<number>; index: number; trade: Trade; on: boolean }) {
  const [a, b] = CHAPTERS[index + 1].range;
  const fill = useTransform(p, [a, b], [0, 1], { clamp: true });
  return (
    <li aria-current={on ? "step" : undefined}>
      <span className="block h-[3px] overflow-hidden rounded-full bg-hair">
        <motion.span className={`block h-full origin-left ${TONE[trade.tone].fill}`} style={{ scaleX: fill }} />
      </span>
      <span className={`hud mt-2 block transition-colors duration-300 ${on ? "text-chalk" : "text-fog"}`}>
        0{index + 1}
        <span className="mt-0.5 hidden xl:block">{serviceOf(trade.id).short}</span>
      </span>
    </li>
  );
}

function Title({ text, play, as: As = "h3" }: { text: string; play: boolean; as?: "h3" | "p" }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useSplitReveal(ref, { play, delay: motionTokens.duration.fast });
  return (
    <As ref={ref} data-split className="display mt-3 text-[1.6rem] text-chalk md:text-[clamp(1.9rem,2.7vw,2.75rem)]">
      {text}
    </As>
  );
}

function Chips({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 flex flex-wrap gap-1.5 md:mt-5">
      {items.map((it) => (
        <li key={it} className="hud rounded-full border border-chalk/15 bg-void/40 px-2.5 py-1 text-mist">
          {it}
        </li>
      ))}
    </ul>
  );
}

function TradePanel({ trade, index, on, done }: { trade: Trade; index: number; on: boolean; done: boolean }) {
  const s = serviceOf(trade.id);
  return (
    <>
      <p className={`eyebrow ${TONE[trade.tone].text}`}>
        System 0{index + 1} / 05 · {s.short}
      </p>
      <Title text={s.title} play={on} />
      {/* phones keep the model in view: properties and chips are desktop extras */}
      <dl className="hud mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-y border-hair py-2.5 max-md:hidden">
        <dt className="text-fog">Category</dt>
        <dd className="text-mist">{trade.category}</dd>
        <dt className="text-fog">Status</dt>
        <dd className="flex items-center gap-2 text-chalk">
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${done ? "bg-green" : "animate-pulse bg-blue-glow"}`} />
          {done ? trade.done : trade.doing}
        </dd>
      </dl>
      <p className="mt-3 text-[15px] leading-relaxed text-mist max-md:line-clamp-3 md:mt-4 md:text-base">{s.body}</p>
      <div className="max-md:hidden">
        <Chips items={s.items} />
      </div>
    </>
  );
}

function IntroPanel({ on }: { on: boolean }) {
  return (
    <>
      <p className="eyebrow text-fog">
        <span className="text-blue-glow">[ 01 ]</span> Systems · The model
      </p>
      <Title text="One building. Five systems." play={on} />
      <p className="mt-3 text-[15px] leading-relaxed text-mist max-md:line-clamp-3 md:mt-4 md:text-base">
        Follow a typical commercial building as each system goes in — the envelope, the air, the exhaust and fresh air,
        the controls, and the care that keeps them all running.
      </p>
      <p className="hud mt-5 text-fog">Scroll to build ↓ · Illustrative model · not to scale</p>
    </>
  );
}

function FinalePanel({ on }: { on: boolean }) {
  return (
    <>
      <p className="eyebrow flex items-center gap-2 text-green-glow">
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-green" /> All systems running
      </p>
      <Title text="Envelope to exhaust, one contractor." play={on} />
      <p className="mt-3 text-[15px] leading-relaxed text-mist md:mt-4 md:text-base">
        Ductwork from our own shop; systems installed, controlled and maintained long after handover.
      </p>
      {/* hidden chapters stay readable to screen readers, but their links leave the Tab order */}
      <div className="mt-5 flex flex-wrap gap-3 md:mt-6">
        <a href="#shop" className="btn btn-ghost" tabIndex={on ? undefined : -1}>
          Inside the shop <span aria-hidden>↓</span>
        </a>
        <a href={BID} className="btn btn-primary" tabIndex={on ? undefined : -1}>
          Request a bid
        </a>
      </div>
    </>
  );
}

function Legend({ active }: { active: number }) {
  return (
    <ul className="glass hud pointer-events-auto absolute bottom-6 right-[var(--gutter)] hidden w-[250px] space-y-2 rounded-lg p-4 text-mist lg:block">
      {LEGEND.map((l) => (
        // systems not yet installed: muted text at full opacity (stays >= 4.5:1), only the swatch fades
        <li key={l.label} className={`flex items-center gap-3 transition-colors duration-500 ${active >= l.from ? "text-mist" : "text-fog"}`}>
          <span aria-hidden className={`flex w-5 justify-start transition-opacity duration-500 ${active >= l.from ? "opacity-100" : "opacity-30"}`}>
            {l.swatch === "dashed" ? (
              <span className="w-5 border-t-2 border-dashed border-signal" />
            ) : l.swatch === "ring" ? (
              <span className="ml-[5px] h-2.5 w-2.5 rounded-full border-[1.5px] border-chalk" />
            ) : (
              <span className={`h-[3px] w-5 rounded-full ${l.swatch}`} />
            )}
          </span>
          {l.label}
        </li>
      ))}
      <li className="border-t border-hair pt-2 text-fog">Values illustrative · NTS</li>
    </ul>
  );
}

function ChapterHud({ active }: { active: number }) {
  const trade = TRADES[active - 1];
  const inside = active >= 2;
  return (
    <div className="glass hud pointer-events-auto absolute right-[var(--gutter)] top-[calc(var(--nav-h)+20px)] hidden items-center gap-5 rounded-lg px-4 py-3 lg:flex">
      <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <span className="text-fog">View</span>
        <span className="text-chalk">{trade ? `System 0${active} / 05 · ${serviceOf(trade.id).short}` : active === 0 ? "3D · Overview" : "3D · All systems"}</span>
        <span className="text-fog">Section box</span>
        <span className={inside ? "text-blue-glow" : "text-fog"}>{inside ? "On · cut A–A" : "Off"}</span>
        <span className="text-fog">X-ray</span>
        <span className={inside ? "text-blue-glow" : "text-fog"}>{inside ? "On" : "Off"}</span>
      </div>
      <ViewCube size={40} />
    </div>
  );
}

/* ------------------------------------------------------------------ story -- */

/** Reduced motion: no pinned scroll — the finished model sits behind a plain list of the five systems. */
function StaticStory() {
  return (
    <section id="systems" aria-labelledby="systems-title" className="relative bg-void/85 py-28 md:py-40">
      <div className="container-x">
        <SectionHeader
          id="systems-title"
          index="01"
          kicker="Systems · The model"
          title="One building. Five systems."
          intro="A typical commercial building with every system in: the envelope, the air, the exhaust and fresh air, the controls, and the care that keeps them all running."
        />
        <div className="mt-14 grid gap-x-10 gap-y-12 md:grid-cols-2 xl:grid-cols-3">
          {TRADES.map((t, i) => (
            <article key={t.id} className="border-t border-hair pt-6">
              <TradePanel trade={t} index={i} on done />
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Lets the pinned panel scroll on its own only while its content overflows (short or zoomed screens). */
function useOverflowScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const check = () => el.toggleAttribute("data-lenis-prevent", el.scrollHeight > el.clientHeight + 1);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    Array.from(el.children).forEach((c) => ro.observe(c));
    return () => ro.disconnect();
  }, []);
  return ref;
}

export default function Story() {
  const reduce = useReducedMotion();
  // the reduced-motion layout swaps in after mount, so the hydration render matches the server's
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const section = useRef<HTMLElement>(null);
  const panel = useOverflowScroll<HTMLDivElement>();
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const [active, setActive] = useState(0);
  const [done, setDone] = useState(false);

  const sync = (v: number) => {
    bim.storyTarget = v;
    const c = chapterAt(v);
    setActive(c);
    const trade = TRADES[c - 1];
    setDone(trade ? v >= trade.doneAt : false);
  };
  useMotionValueEvent(scrollYProgress, "change", sync);
  useEffect(() => {
    if (!reduce) sync(scrollYProgress.get());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync only reads refs and stable setters
  }, [reduce, scrollYProgress]);

  if (mounted && reduce) return <StaticStory />;

  const panels = [
    <IntroPanel key="model" on={active === 0} />,
    ...TRADES.map((t, i) => <TradePanel key={t.id} trade={t} index={i} on={active === i + 1} done={active === i + 1 && done} />),
    <FinalePanel key="finale" on={active === CHAPTERS.length - 1} />,
  ];

  return (
    <section ref={section} id="systems" aria-labelledby="systems-title" className="relative h-[640vh] md:h-[760vh]">
      <h2 id="systems-title" className="sr-only">
        Systems — one building, trade by trade
      </h2>
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <ChapterHud active={active} />
        <Legend active={active} />

        {/* centred in the space under the nav; capped to the screen and scrollable when it can't fit */}
        <div
          ref={panel}
          className="glass pointer-events-auto absolute inset-x-3 bottom-3 max-h-[46svh] overflow-y-auto overscroll-contain rounded-xl p-5 [scrollbar-width:thin] md:inset-x-[var(--gutter)] md:max-h-[52svh] md:p-6 lg:bottom-auto lg:left-[var(--gutter)] lg:right-auto lg:top-[calc(50%+var(--nav-h)/2)] lg:max-h-[calc(100svh-var(--nav-h)-3rem)] lg:w-[min(460px,36vw)] lg:-translate-y-1/2 lg:p-7"
        >
          <Rail p={scrollYProgress} active={active} />
          {/* every chapter stays in the DOM (screen readers get all of them); only the active one shows,
              and only the active one takes up space, so the panel fits the chapter on screen */}
          <div className="relative mt-4 md:mt-7">
            {panels.map((panel, i) => (
              <motion.article
                key={CHAPTERS[i].id}
                className={i === active ? "relative" : "absolute inset-0 overflow-hidden"}
                initial={false}
                animate={i === active ? "on" : "off"}
                variants={{
                  on: { opacity: 1, y: 0, transition: { duration: motionTokens.duration.normal, ease: motionTokens.easing.smooth, delay: motionTokens.duration.fast } },
                  off: { opacity: 0, y: -motionTokens.distance.sm, transition: { duration: motionTokens.duration.fast } },
                }}
                style={{ pointerEvents: i === active ? "auto" : "none" }}
              >
                {panel}
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
