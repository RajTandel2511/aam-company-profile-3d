import { easeInOutCubic, easeOutCubic, seg } from "@/lib/timing";

/**
 * When everything happens. Two clocks drive the model:
 *   bim.intro — the load-time 4D construction sequence (0..1 over INTRO_SECONDS)
 *   bim.story — scroll progress through the systems story (0..1)
 * Every part derives its state as a pure function of these, so scrubbing
 * backwards un-builds the model exactly.
 */

export type Window = readonly [number, number];

export const INTRO_SECONDS = 4.6;

/** Load-time sequence, as fractions of bim.intro. Columns and slabs go floor by floor inside their windows. */
export const INTRO = {
  grid: [0.0, 0.14],
  footings: [0.06, 0.2],
  columns: [0.14, 0.56],
  slabs: [0.2, 0.66],
  core: [0.24, 0.66],
  roof: [0.6, 0.76],
  envelope: [0.66, 0.96],
  annotations: [0.78, 1.0],
} as const satisfies Record<string, Window>;

export type ChapterId = "model" | "sheetmetal" | "hvac" | "exhaust" | "controls" | "maintenance" | "finale";

/** Story chapters in scroll order. The five trades map 1:1 to content.services ids. */
export const CHAPTERS: readonly { id: ChapterId; range: Window }[] = [
  { id: "model", range: [0.0, 0.1] },
  { id: "sheetmetal", range: [0.1, 0.25] },
  { id: "hvac", range: [0.25, 0.43] },
  { id: "exhaust", range: [0.43, 0.58] },
  { id: "controls", range: [0.58, 0.73] },
  { id: "maintenance", range: [0.73, 0.88] },
  { id: "finale", range: [0.88, 1.0] },
];

/**
 * Build windows inside each chapter (story progress). A part is absent before
 * its window, builds across it, and stays afterwards. Ambient loops (flows,
 * pulses) start at their `run` mark and keep running to the end.
 */
export const STORY = {
  sheetmetal: {
    panels: [0.11, 0.2],
    coping: [0.12, 0.165],
    flashing: [0.14, 0.18],
    gutters: [0.16, 0.21],
    canopy: [0.18, 0.225],
    glint: [0.205, 0.245],
  },
  /** Section box engages and the architecture ghosts as the story goes inside. */
  section: [0.25, 0.3],
  xray: [0.25, 0.3],
  hvac: {
    rtu: [0.27, 0.315],
    trunks: [0.3, 0.34],
    supply: [0.325, 0.385],
    ret: [0.345, 0.405],
    terminals: [0.36, 0.42],
    run: 0.4,
  },
  exhaust: {
    riser: [0.44, 0.475],
    branches: [0.46, 0.505],
    grilles: [0.48, 0.52],
    fan: [0.48, 0.52],
    oa: [0.51, 0.55],
    run: 0.53,
  },
  controls: {
    panel: [0.59, 0.615],
    riser: [0.605, 0.64],
    lines: [0.625, 0.69],
    sensors: [0.655, 0.705],
    run: 0.68,
  },
  maintenance: {
    /** one window per SERVICE_STOPS entry, in order */
    stops: [
      [0.75, 0.79],
      [0.79, 0.83],
      [0.83, 0.87],
    ],
  },
  finale: {
    running: [0.9, 0.94],
  },
} as const;

/** Local 0..1 progress of p inside window w. */
export const win = (p: number, w: Window) => seg(p, w[0], w[1]);
/** Eased (in-out cubic) local progress — for placements and camera-like moves. */
export const ease = (p: number, w: Window) => easeInOutCubic(seg(p, w[0], w[1]));
/** Eased-out local progress — for things that arrive and settle. */
export const arrive = (p: number, w: Window) => easeOutCubic(seg(p, w[0], w[1]));
/** Sub-window i of n inside w, overlapping by `overlap` (0..1) — floor-by-floor and bay-by-bay sequencing. */
export function stagger(w: Window, i: number, n: number, overlap = 0.5): Window {
  const span = (w[1] - w[0]) / (n - (n - 1) * overlap);
  const a = w[0] + i * span * (1 - overlap);
  return [a, a + span];
}

/** Index into CHAPTERS for story progress p. */
export function chapterAt(p: number): number {
  for (let i = CHAPTERS.length - 1; i >= 0; i--) if (p >= CHAPTERS[i].range[0]) return i;
  return 0;
}
