import { FLOORS, GRID_X } from "../../geometry";
import { INTRO, stagger, type Window } from "../../timeline";

/**
 * The 4D sequence of the bare building, as windows of bim.intro. Floors go up
 * in a strict rhythm so nothing ever passes through anything else: a floor's
 * columns rise west -> east; the slab above starts dropping while the last bays
 * finish, lands just after them, and has settled before the next floor's
 * columns rise from it. Within INTRO.columns / INTRO.slabs throughout.
 */

const at = (w: Window, t: number) => w[0] + (w[1] - w[0]) * t;

/** One floor of columns, west bay to east bay. */
const COLUMN_FLOOR = 0.1;
/** Floor-to-floor cadence: the top floor's columns finish exactly as INTRO.columns ends. */
export const CADENCE = (INTRO.columns[1] - INTRO.columns[0] - COLUMN_FLOOR) / (FLOORS - 1);
/** One slab drop — short enough to have settled before the next floor's columns rise from it. */
const SLAB_DROP = 0.06;
/** The bright placement flash after a column or a slab lands. */
export const FLASH = 0.04;

/** Pad footings on grid x-index ix push up out of the ground, west to east. */
export const footingWin = (ix: number): Window =>
  stagger([INTRO.footings[0], at(INTRO.footings, 0.6)], ix, GRID_X.length, 0.5);

/** The slab-on-grade rises around the footings once they are up. */
export const gradeSlabWin: Window = [at(INTRO.footings, 0.35), at(INTRO.footings, 0.9)];

/** One floor of columns (f = 0..3 -> L1..L4). */
export const columnFloor = (f: number): Window => {
  const a = INTRO.columns[0] + f * CADENCE;
  return [a, a + COLUMN_FLOOR];
};

/** The column on grid x-index ix of floor f. */
export const columnWin = (f: number, ix: number): Window => stagger(columnFloor(f), ix, GRID_X.length, 0.6);

/** The slab on top of floor f: f = 0..2 -> L2..L4, f = 3 -> the roof slab. */
export const slabWin = (f: number): Window => {
  const a = INTRO.slabs[0] + f * CADENCE;
  return [a, a + SLAB_DROP];
};

/** Roof works, in order: 0 parapet, 1 membrane, 2 stair penthouse. */
export const roofWin = (k: number): Window => stagger(INTRO.roof, k, 3, 0.3);
