/**
 * Reach — everything the Bay Area twin draws, derived once from lib/content and
 * lib/bayarea. Pure values (no three.js), so the server-rendered city list and the
 * client-only canvas read exactly the same numbers.
 *
 * Map units: lib/bayarea's 800 x 1346.8 frame (y down). World units: map units x
 * WORLD_SCALE, centred on the cities — x east, z south, y up.
 */
import { activeByCity, contact, currentProjects, stats, type Sector } from "@/lib/content";
import { CITY_COORDS, project } from "@/lib/bayarea";
import { motionTokens } from "@/lib/motion-tokens";

export const WORLD_SCALE = 0.01;
/** County slab thickness, world units. */
export const SLAB = 0.05;
/** One active project = one floor plate on a city's pillar, this far apart (world units). */
export const LEVEL = 0.3;

/** Night palette for the canvas. Hexes mirror the tokens in app/globals.css. */
export const TWIN_COLORS = {
  void: "#090B0E",
  land: "#131820",
  landSide: "#1E2630",
  edge: "#C4CCD5",
  dot: "#ECF0F4",
  grid: "#2A313A",
  scan: "#3FA3E6",
} as const;

/** The logo's three streams in logo order: supply blue, exhaust green, return red. Cities cycle through them. */
export const STREAMS = [
  { glow: "#3FA3E6", text: "text-blue-glow", fill: "bg-blue" },
  { glow: "#2FCB6E", text: "text-green-glow", fill: "bg-green" },
  { glow: "#F0584D", text: "text-red-glow", fill: "bg-red" },
] as const;

export type StreamIndex = 0 | 1 | 2;
export type CityProject = { name: string; sector: Sector };

export type ReachCity = {
  name: string;
  count: number;
  /** world position on the ground plane */
  x: number;
  z: number;
  /** 0..1 — distance from HQ relative to the farthest city; drives every stagger */
  reach: number;
  stream: StreamIndex;
  isHQ: boolean;
  /** the named subset of this city's work (content.ts currentProjects) */
  projects: readonly CityProject[];
  /** seconds after the map enters view */
  pillarAt: number;
  arcAt: number;
  arcEnd: number;
};

/**
 * Scene clocks, mutated once per frame — read them inside useFrame. t: seconds since the
 * map entered view (the build sequence). amb: seconds of ambient motion (camera drift, HQ
 * pulse, sparks), which stands still while the visitor has paused motion.
 */
export type TwinClock = { t: number; amb: number };
/** Eased highlight per city (CITIES order), mutated once per frame: on = this city is active, dim = another is. */
export type Focus = { on: number; dim: number }[];

const D = motionTokens.duration;

/** The scroll-in sequence, in seconds after the map enters view: counties rise -> pillars grow -> arcs draw. */
export const CHOREO = {
  /** counties start rising outward from HQ across this window */
  countyWave: D.slow,
  countyRise: D.crawl,
  hqAt: D.normal,
  /** first pillar starts; the farthest starts pillarWave later */
  pillarsAt: D.crawl,
  pillarWave: D.crawl,
  pillarGrow: D.slow,
  /** first arc leaves HQ; the farthest leaves arcWave later and takes twice arcDraw */
  arcsAt: D.crawl * 2,
  arcWave: D.crawl,
  arcDraw: D.slow,
  /** labels and particles fade in */
  fade: D.normal,
} as const;

const [HQ_MX, HQ_MY] = project(contact.hq.lat, contact.hq.lon);

// Stable sort: content order breaks ties, so ranks and colours never shuffle.
const ranked = Object.entries(activeByCity)
  .sort((a, b) => b[1] - a[1])
  .map(([name, count]) => {
    const coords = CITY_COORDS[name];
    if (!coords) throw new Error(`Reach map: lib/bayarea.ts CITY_COORDS has no entry for "${name}".`);
    const [mx, my] = project(coords[0], coords[1]);
    return { name, count, mx, my, dist: Math.hypot(mx - HQ_MX, my - HQ_MY) * WORLD_SCALE };
  });

const xs = ranked.map((c) => c.mx);
const ys = ranked.map((c) => c.my);

/** World origin: the centre of the cities' bounding box, in map units. */
export const ORIGIN: readonly [number, number] = [
  (Math.min(...xs) + Math.max(...xs)) / 2,
  (Math.min(...ys) + Math.max(...ys)) / 2,
];

export function toWorld(mx: number, my: number): [number, number] {
  return [(mx - ORIGIN[0]) * WORLD_SCALE, (my - ORIGIN[1]) * WORLD_SCALE];
}

/** HQ on the ground plane, [x, z]. */
export const HQ = toWorld(HQ_MX, HQ_MY);
/** World distance from HQ to the farthest city with active work. */
export const MAX_REACH = Math.max(...ranked.map((c) => c.dist));

export const CITIES: readonly ReachCity[] = ranked.map((c, i) => {
  const [x, z] = toWorld(c.mx, c.my);
  const reach = c.dist / MAX_REACH;
  const arcAt = CHOREO.arcsAt + reach * CHOREO.arcWave;
  return {
    name: c.name,
    count: c.count,
    x,
    z,
    reach,
    stream: (i % 3) as StreamIndex,
    isHQ: c.dist < 0.01,
    projects: currentProjects.filter((p) => p.city === c.name).map(({ name, sector }) => ({ name, sector })),
    pillarAt: CHOREO.pillarsAt + reach * CHOREO.pillarWave,
    arcAt,
    arcEnd: arcAt + CHOREO.arcDraw * (1 + reach),
  };
});

export const HQ_INDEX = CITIES.findIndex((c) => c.isHQ);
export const CHOREO_END = Math.max(...CITIES.map((c) => c.arcEnd)) + CHOREO.fade;
export const TOTAL = CITIES.reduce((n, c) => n + c.count, 0);
export const MAX_COUNT = CITIES[0].count;
/** "South San Francisco" — the city part of the HQ address. */
export const HQ_CITY = contact.city.split(",")[0];
/** "As of Aug 2026" — the date content.ts attaches to the active-project count. */
export const AS_OF = stats.find((s) => s.value === TOTAL)?.note ?? "";
// Fail the build rather than publish a total that disagrees with the stats line.
if (!AS_OF) throw new Error(`Reach map: activeByCity sums to ${TOTAL}, but no stats entry has that value — make lib/content.ts agree.`);

const byLatitude = [...CITIES].sort((a, b) => a.z - b.z);
export const NORTHMOST = byLatitude[0].name;
export const SOUTHMOST = byLatitude[byLatitude.length - 1].name;

const busiest = CITIES.filter((c) => c.count === MAX_COUNT).map((c) => c.name);

/** Canvas summary for screen readers (the city list below the map carries every detail). */
export const MAP_LABEL =
  `Map of the Bay Area with ${TOTAL} active All Air Mechanical projects across ${CITIES.length} cities, ` +
  `drawn as arcs from headquarters in ${HQ_CITY}; most are in ` +
  `${new Intl.ListFormat("en", { type: "conjunction" }).format(busiest)} (${MAX_COUNT}${busiest.length > 1 ? " each" : ""}).`;
