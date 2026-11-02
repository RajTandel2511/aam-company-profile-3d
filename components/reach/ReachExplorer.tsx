"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { GLBoundary, useWebGL2 } from "@/components/GLBoundary";
import { contact } from "@/lib/content";
import { motionTokens } from "@/lib/motion-tokens";
import { useSafeMotion } from "@/lib/use-safe-motion";
import { AS_OF, CITIES, HQ_CITY, MAP_LABEL, MAX_COUNT, STREAMS, type ReachCity } from "./data";

// three / R3F / drei need the browser — keep them out of the server render.
const BayTwin = dynamic(() => import("./BayTwin"), { ssr: false });

const LIST_TITLE_ID = "reach-cities-title";
/** The map fades into the void at its edges instead of being cut off. */
const VIGNETTE = "radial-gradient(ellipse 74% 70% at 50% 48%, transparent 56%, rgb(var(--void-rgb)) 100%)";
const BAR = {
  hidden: { scaleX: 0 },
  shown: { scaleX: 1, transition: { duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth } },
};

type CityHandler = (city: string | null) => void;

/**
 * The twin and its accessible companion: hovering or focusing a city in the list
 * lights its pillar, and hovering a pillar lights the row. Click / Enter pins a
 * city; Escape or a click on empty map clears the pin.
 */
export function ReachExplorer() {
  const webgl = useWebGL2();
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = hovered ?? pinned;
  const select: CityHandler = (name) => setPinned((p) => (name === null || p === name ? null : name));
  const city = CITIES.find((c) => c.name === active);

  return (
    <div className="mt-14 grid gap-8 lg:mt-20 lg:grid-cols-12 lg:gap-10">
      <div className="lg:col-span-7">
        <div
          role="img"
          aria-label={MAP_LABEL}
          className="relative isolate aspect-square w-full overflow-hidden rounded-[4px] border border-hair bg-void lg:sticky lg:top-24 lg:aspect-auto lg:h-[min(80vh,800px)]"
        >
          {webgl && (
            <GLBoundary>
              <BayTwin active={active} onHover={setHovered} onSelect={select} />
            </GLBoundary>
          )}
          <ViewportHud />
        </div>
      </div>
      <div className="flex flex-col gap-8 lg:col-span-5">
        <Readout city={city} />
        <CityList active={active} pinned={pinned} onHover={setHovered} onSelect={select} />
      </div>
    </div>
  );
}

/** Viewport furniture in the Revit idiom: crop corners, view name, north point, date stamp. */
function ViewportHud() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0" style={{ background: VIGNETTE }} />
      <span className="absolute left-3 top-3 h-4 w-4 border-l border-t border-chalk/30" />
      <span className="absolute right-3 top-3 h-4 w-4 border-r border-t border-chalk/30" />
      <span className="absolute bottom-3 left-3 h-4 w-4 border-b border-l border-chalk/30" />
      <span className="absolute bottom-3 right-3 h-4 w-4 border-b border-r border-chalk/30" />
      <p className="hud absolute left-6 top-6 text-fog">
        3D view · Bay Area
        <br />
        County lines · US Census
      </p>
      <div className="hud absolute right-6 top-6 flex flex-col items-center gap-1 text-fog">
        <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
          <path d="M5 0l5 14-5-4-5 4z" />
        </svg>
        N
      </div>
      <p className="hud absolute bottom-6 right-6 text-fog">{AS_OF}</p>
    </div>
  );
}

/**
 * The properties palette: the active city's work in progress, or HQ and the map key.
 * Announced politely. Its floor fits the fullest city (San Francisco, 7 named) even at
 * 375 px, so hovering down the list never resizes it and shifts rows under the cursor.
 */
function Readout({ city }: { city: ReachCity | undefined }) {
  const m = useSafeMotion(motionTokens.distance.sm);
  return (
    <div aria-live="polite" className="glass relative min-h-[27rem] overflow-hidden rounded-[4px] p-5 md:p-6">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={city?.name ?? "hq"} initial={m.initial} animate={m.animate} exit={m.exit} transition={m.transition}>
          {city ? <CityDetail city={city} /> : <HqDetail />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function HqDetail() {
  return (
    <>
      <p className="eyebrow text-red-glow">Headquarters</p>
      <h3 className="mt-2 text-2xl font-bold leading-tight text-chalk">{HQ_CITY}</h3>
      <p className="mono mt-1.5 text-sm text-mist">{contact.street}</p>
      <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-mist">
        Every arc on the map starts here. Hover, tap or focus a city to see the work in progress there.
      </p>
      <ul className="mt-6 space-y-3 border-t border-hair pt-5">
        <li className="hud flex items-center gap-3 text-fog">
          <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" className="shrink-0">
            <path d="M11 21V3" className="stroke-fog" strokeWidth="1" />
            {[4, 9, 14].map((y) => (
              <rect key={y} x="5" y={y} width="12" height="2" rx="1" className="fill-blue-glow" />
            ))}
          </svg>
          One plate on a pillar = one project in progress
        </li>
        <li className="hud flex items-center gap-3 text-fog">
          <svg aria-hidden="true" width="22" height="14" viewBox="0 0 22 14" fill="none" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
            {["stroke-blue", "stroke-green", "stroke-red"].map((c, i) => (
              <path key={c} className={c} d={`M1 ${12 - i * 2}Q11 ${3 - i * 2} 21 ${12 - i * 2}`} />
            ))}
          </svg>
          Arcs: the logo&apos;s three streams, HQ to every job
        </li>
      </ul>
    </>
  );
}

function CityDetail({ city }: { city: ReachCity }) {
  const stream = STREAMS[city.stream];
  const more = city.count - city.projects.length;
  return (
    <>
      <p className={`eyebrow ${city.isHQ ? "text-red-glow" : stream.text}`}>{city.isHQ ? "Headquarters city" : "Active work"}</p>
      <h3 className="mt-2 text-2xl font-bold leading-tight text-chalk">{city.name}</h3>
      <p className="mono mt-1.5 text-sm text-mist">
        <span className={stream.text}>{city.count}</span> in progress
      </p>
      {city.projects.length > 0 && (
        <ul className="mt-4 divide-y divide-hair border-y border-hair">
          {city.projects.map((p) => (
            <li key={p.name} className="flex items-baseline justify-between gap-4 py-1.5">
              <span className="text-[14.5px] font-semibold leading-snug text-chalk">{p.name}</span>
              <span className="hud max-w-[45%] text-right text-fog">{p.sector}</span>
            </li>
          ))}
        </ul>
      )}
      {city.projects.length > 0 && more > 0 && <p className="hud mt-3 text-fog">+ {more} more in progress</p>}
    </>
  );
}

type ListProps = { active: string | null; pinned: string | null; onHover: CityHandler; onSelect: CityHandler };

function CityList({ active, pinned, onHover, onSelect }: ListProps) {
  return (
    <div>
      <h3 id={LIST_TITLE_ID} className="eyebrow border-b border-hair pb-3 text-fog">
        Active work by city · most first
      </h3>
      <motion.ol
        aria-labelledby={LIST_TITLE_ID}
        className="mt-2 grid grid-cols-2 gap-x-3"
        initial="hidden"
        whileInView="shown"
        viewport={{ once: true, margin: "-80px" }}
        variants={{ shown: { transition: { staggerChildren: motionTokens.stagger } } }}
      >
        {CITIES.map((c) => (
          <li key={c.name}>
            <CityRow city={c} isActive={active === c.name} isPinned={pinned === c.name} onHover={onHover} onSelect={onSelect} />
          </li>
        ))}
      </motion.ol>
    </div>
  );
}

type RowProps = { city: ReachCity; isActive: boolean; isPinned: boolean; onHover: CityHandler; onSelect: CityHandler };

function CityRow({ city, isActive, isPinned, onHover, onSelect }: RowProps) {
  const stream = STREAMS[city.stream];
  const tone = isActive ? "bg-chalk/[0.06] text-chalk" : "text-mist hover:bg-chalk/[0.04]";
  return (
    <button
      type="button"
      aria-pressed={isPinned}
      onMouseEnter={() => onHover(city.name)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(city.name)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(city.name)}
      onKeyDown={(e) => {
        if (e.key === "Escape") onSelect(null);
      }}
      className={`relative grid min-h-[44px] w-full grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-[3px] px-2.5 pb-1 text-left text-[14px] leading-tight transition-colors focus-visible:outline-offset-0 aria-pressed:ring-1 aria-pressed:ring-inset aria-pressed:ring-chalk/30 lg:min-h-[38px] ${tone}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${stream.fill}`} />
      <span className="py-1.5">
        {city.name}
        {city.isHQ && <span className="hud ml-1.5 text-red-glow">HQ</span>}
      </span>
      <span className={`mono text-[13px] ${isActive ? stream.text : "text-fog"}`}>
        {city.count}
        <span className="sr-only"> in progress</span>
      </span>
      {/* Bar: the outer span holds the true length (correct without JS); the inner one grows into it. */}
      <span aria-hidden="true" className="absolute inset-x-2.5 bottom-1 h-px bg-hair" />
      <span aria-hidden="true" className="absolute inset-x-2.5 bottom-1 h-px origin-left" style={{ transform: `scaleX(${city.count / MAX_COUNT})` }}>
        <motion.span data-reveal className={`block h-full origin-left ${stream.fill}`} variants={BAR} />
      </span>
    </button>
  );
}
