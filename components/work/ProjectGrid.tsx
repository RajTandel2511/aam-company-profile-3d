"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion, type Variants } from "motion/react";
import { currentProjects, sectors, type Sector } from "@/lib/content";
import { motionTokens, springs } from "@/lib/motion-tokens";
import { Reveal } from "@/components/ui/Reveal";
import { pad } from "./parts";

type Filter = Sector | "All";

const FILTERS: Filter[] = ["All", ...sectors];

/** Revit-style type marks for the hover tag. Presentation labels only, not data. */
const CODE: Record<Sector, string> = {
  Hospitality: "HSP",
  "Retail & Showroom": "RTL",
  Education: "EDU",
  "Residential & Senior Living": "RES",
  Restaurants: "RST",
  "Recreation & Fitness": "REC",
  "Healthcare & Wellness": "HCW",
  "Workplace, Industrial & Civic": "CIV",
};

/** Fills only (edge bar, chip dot, hover glow): the logo's three streams cycled across sectors. */
const STREAMS = ["var(--blue)", "var(--green)", "var(--red)"] as const;
const streamFor = (s: Sector) => STREAMS[sectors.indexOf(s) % STREAMS.length];

const PROJECTS = currentProjects.map((p) => ({
  ...p,
  id: `${p.name}|${p.city}`,
  // Sector code only — a numbered mark (HSP-03) would read as a real project number.
  mark: CODE[p.sector],
}));

const byFilter = (f: Filter) => (f === "All" ? PROJECTS : PROJECTS.filter((p) => p.sector === f));
const COUNT = Object.fromEntries(FILTERS.map((f) => [f, byFilter(f).length])) as Record<Filter, number>;

/** Cards past the 9th share the last delay, so any set lands within ~0.6 s. */
const STAGGER_CAP = 8;

const HIDDEN = { opacity: 0, y: motionTokens.distance.md };
const SHOWN = { opacity: 1, y: 0 };
const FADE = { duration: motionTokens.duration.fast };
const RISE = { duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth };
const EXIT = { opacity: 0, scale: motionTokens.scale.subtle, transition: FADE };
const FADE_EXIT = { opacity: 0, transition: FADE };
// Rest states are constant (they are the SSR markup); only the hover targets drop transforms under reduced motion.
const LIFT: Variants = { rest: { y: 0 }, hover: { y: -motionTokens.distance.xs } };
const STILL: Variants = { rest: { y: 0 }, hover: { y: 0 } };
const TAG: Variants = { rest: { opacity: 0, y: motionTokens.distance.xs }, hover: { opacity: 1, y: 0 } };
/** CSS-side colour/opacity transitions on the same token timing as the motion ones. */
const CSS_TIMING = { transitionDuration: `${motionTokens.duration.normal}s`, transitionTimingFunction: "var(--ease-out)" };

type ChipProps = { filter: Filter; isOn: boolean; onSelect: (f: Filter) => void };

/** A sector toggle. The active one carries the shared blue "selection" pill, which slides between chips. */
function Chip({ filter, isOn, onSelect }: ChipProps) {
  const dot = filter === "All" ? null : (
    <span
      aria-hidden
      className={`h-1.5 w-1.5 rounded-full ${isOn ? "bg-white" : ""}`}
      style={isOn ? undefined : { background: streamFor(filter) }}
    />
  );
  return (
    <button
      type="button"
      aria-pressed={isOn}
      aria-controls="work-projects"
      onClick={() => onSelect(filter)}
      className={`relative isolate inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold leading-none transition-colors ${
        isOn ? "border-transparent text-white" : "border-hair text-mist hover:border-chalk/40 hover:text-chalk"
      }`}
    >
      {isOn && (
        <motion.span
          layoutId="work-filter-pill"
          aria-hidden
          className="absolute -inset-px -z-10 rounded-full bg-blue"
          transition={springs.snappy}
        />
      )}
      {dot}
      {filter}
      <span className={`mono text-[11px] font-medium ${isOn ? "text-white" : "text-fog"}`}>
        {COUNT[filter]}
        <span className="sr-only"> projects</span>
      </span>
    </button>
  );
}

type Props = { asOf?: string };

/**
 * Current projects (all IN PROGRESS) behind a sector view filter. Cards stagger in on
 * first view; filtering pops leavers out of the flow and lets the rest glide to their
 * new cells (layout on the small cards only).
 */
export default function ProjectGrid({ asOf }: Props) {
  const reduce = useReducedMotion();
  const [filter, setFilter] = useState<Filter>("All");
  const gridRef = useRef<HTMLUListElement>(null);
  const inView = useInView(gridRef, { once: true, margin: "-80px" });
  const list = byFilter(filter);
  const hoverTiming = reduce ? FADE : springs.snappy;

  return (
    <div className="mt-14 md:mt-20">
      <Reveal className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p aria-hidden className="hud text-fog">
            View filter <span className="text-hair">/</span> Sector
          </p>
          <div role="group" aria-label="Filter current projects by sector" className="mt-3 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Chip key={f} filter={f} isOn={f === filter} onSelect={setFilter} />
            ))}
          </div>
        </div>
        <p className="hud shrink-0 text-fog lg:pb-2.5">
          <span aria-hidden>
            Showing <span className="text-chalk">{pad(list.length)}</span> / {pad(PROJECTS.length)}
            <span className="mx-2 text-hair">|</span>
            <span className="text-green-glow">In progress</span>
            {asOf && <span> · {asOf}</span>}
          </span>
          <span className="sr-only" aria-live="polite">
            {`${list.length} of ${PROJECTS.length} current projects shown.`}
          </span>
        </p>
      </Reveal>

      <ul
        id="work-projects"
        ref={gridRef}
        className="relative mt-8 grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4"
      >
        <AnimatePresence mode="popLayout">
          {list.map((p, i) => {
            const stream = streamFor(p.sector);
            return (
              <motion.li
                key={p.id}
                layout
                data-reveal
                initial={HIDDEN}
                animate={inView ? SHOWN : HIDDEN}
                exit={reduce ? FADE_EXIT : EXIT}
                transition={{
                  default: reduce ? FADE : { ...RISE, delay: Math.min(i, STAGGER_CAP) * motionTokens.stagger },
                  layout: springs.snappy,
                }}
              >
                <motion.div
                  initial="rest"
                  animate="rest"
                  whileHover="hover"
                  variants={reduce ? STILL : LIFT}
                  transition={hoverTiming}
                  style={CSS_TIMING}
                  className="group relative flex h-full min-h-[8.75rem] flex-col rounded-[4px] border border-hair bg-panel/70 py-4 pl-5 pr-4 transition-colors hover:border-chalk/25"
                >
                  <span
                    aria-hidden
                    style={{ ...CSS_TIMING, boxShadow: `0 22px 44px -26px ${stream}` }}
                    className="pointer-events-none absolute inset-0 rounded-[4px] opacity-0 transition-opacity group-hover:opacity-100"
                  />
                  <span aria-hidden className="absolute inset-y-4 left-0 w-[2px]" style={{ background: stream }} />
                  <p className="hud flex items-center gap-2 text-green-glow">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-green shadow-[0_0_0_3px_rgb(var(--green-rgb)/0.2)]" />
                    In progress
                  </p>
                  <h3 className="mt-3 text-[15px] font-bold leading-snug text-chalk sm:text-base">{p.name}</h3>
                  <p className="mt-1 text-[13px] leading-snug text-mist">{p.city}</p>
                  <p className="hud mt-auto pt-4 text-fog">{p.sector}</p>
                  <motion.span aria-hidden variants={TAG} transition={hoverTiming} className="bim-tag absolute right-3 top-3">
                    {p.mark}
                  </motion.span>
                </motion.div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
