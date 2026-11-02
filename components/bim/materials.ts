import * as THREE from "three";
import { lerp } from "@/lib/timing";

/**
 * Shared palette and materials for the BIM scene. Parts never create their own
 * materials for these categories — they import from here, so X-ray ghosting and
 * the section box apply to everything at once.
 *
 *   ARCH  — structure, envelope, sheet metal. Clipped by the section box, X-ray capable.
 *   MEP   — ducts, equipment, controls. Never clipped; they are what the cut reveals.
 *   GLOW  — particles, pulses, highlights. Unlit, toneMapped off, colour pushed > 1 so bloom catches it.
 *
 * Client-only module (creates THREE objects at import) — import it only from
 * files under components/bim, which load via next/dynamic with ssr: false.
 */

export const COLORS = {
  void: "#090B0E",
  ground: "#0D1015",
  gridCell: "#161C23",
  gridSection: "#222A33",
  concrete: "#8C939B",
  concreteShade: "#6B727A",
  roof: "#3B4149",
  glass: "#8EC5EA",
  mullion: "#A9B2BC",
  sheetMetal: "#C6CED6",
  sheetMetalShade: "#87919B",
  equipment: "#D3D8DD",
  equipmentShade: "#59616A",
  edge: "#DCE3EA",
  supply: "#0078C0",
  supplyGlow: "#3FA3E6",
  ret: "#EA362A",
  retGlow: "#F0584D",
  exhaust: "#00A848",
  exhaustGlow: "#2FCB6E",
  signal: "#E6EEF5",
  sectionBox: "#3FA3E6",
} as const;

/** Section box: geometry with z > constant is clipped. Constant is animated by SectionBox (1e4 = no cut). */
export const sectionPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e4);
export const CLIP = [sectionPlane];

type StdOpts = THREE.MeshStandardMaterialParameters;

function archMat(opts: StdOpts) {
  return new THREE.MeshStandardMaterial({ transparent: true, clippingPlanes: CLIP, clipShadows: true, ...opts });
}
function mepMat(color: string, opts: StdOpts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.35, emissive: color, emissiveIntensity: 0.22, ...opts });
}
function glowMat(color: string, boost: number, opts: THREE.MeshBasicMaterialParameters = {}) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(boost), toneMapped: false, ...opts });
}

export const ARCH = {
  concrete: archMat({ color: COLORS.concrete, roughness: 0.92, metalness: 0 }),
  concreteShade: archMat({ color: COLORS.concreteShade, roughness: 0.95, metalness: 0 }),
  roof: archMat({ color: COLORS.roof, roughness: 0.85, metalness: 0.05 }),
  glass: archMat({ color: COLORS.glass, roughness: 0.08, metalness: 0.6, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }),
  mullion: archMat({ color: COLORS.mullion, roughness: 0.4, metalness: 0.7 }),
  /** galvalume / zinc: coping, flashing, gutters, wall panels, roofing */
  // half-metallic so galvanized panels still catch the key light, not only reflections
  sheetMetal: archMat({ color: COLORS.sheetMetal, roughness: 0.34, metalness: 0.55, envMapIntensity: 1.3 }),
  sheetMetalShade: archMat({ color: COLORS.sheetMetalShade, roughness: 0.4, metalness: 0.5, envMapIntensity: 1.2 }),
  /** BIM linework over the architecture (use with LineSegments / EdgesGeometry). */
  edge: new THREE.LineBasicMaterial({ color: COLORS.edge, transparent: true, opacity: 0.32, clippingPlanes: CLIP, depthWrite: false }),
} as const;

export const MEP = {
  supply: mepMat(COLORS.supply),
  ret: mepMat(COLORS.ret),
  exhaust: mepMat(COLORS.exhaust),
  equipment: mepMat(COLORS.equipment, { roughness: 0.5, metalness: 0.55, emissiveIntensity: 0.04 }),
  equipmentShade: mepMat(COLORS.equipmentShade, { roughness: 0.6, metalness: 0.5, emissiveIntensity: 0.02 }),
  signal: mepMat(COLORS.signal, { roughness: 0.6, metalness: 0.1, emissiveIntensity: 0.35 }),
  /** duct / equipment linework */
  edge: new THREE.LineBasicMaterial({ color: COLORS.edge, transparent: true, opacity: 0.55, depthWrite: false }),
} as const;

export const GLOW = {
  supply: glowMat(COLORS.supplyGlow, 2.4),
  ret: glowMat(COLORS.retGlow, 2.4),
  exhaust: glowMat(COLORS.exhaustGlow, 2.4),
  signal: glowMat(COLORS.signal, 2.0),
  white: glowMat("#ffffff", 2.6),
  /** the extrusion head / placement spark on a growing part */
  spark: glowMat("#ffffff", 4.0, { transparent: true }),
} as const;

/* ACES pre-compensation ------------------------------------------------------ */

/** three's ACES filmic curve (RRT + ODT fit) on the grey axis, exposure 1. */
const acesCurve = (v: number) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);

/** The linear value that comes out of ACES as `target` (bisection; the curve is monotonic). */
function acesInverse(target: number): number {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (acesCurve(mid / 0.6) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * A colour that renders as `hex` AFTER tone mapping — so the stage's background
 * and fog land exactly on the page's --void instead of a crushed near-black,
 * and the canvas meets the HTML sections without a seam.
 */
export function preToneMapped(hex: string): THREE.Color {
  const c = new THREE.Color(hex); // linear working space
  return new THREE.Color(acesInverse(c.r), acesInverse(c.g), acesInverse(c.b));
}

/** Architecture opacity at full X-ray: ghosted, linework stays. */
const GHOST = { concrete: 0.13, concreteShade: 0.16, roof: 0.12, glass: 0.06, mullion: 0.22, sheetMetal: 0.3, sheetMetalShade: 0.3 };

/** Called once per frame by the scene with bim.xray (0 solid … 1 ghosted). */
export function applyXray(x: number) {
  for (const key of Object.keys(GHOST) as (keyof typeof GHOST)[]) {
    const m = ARCH[key];
    const solid = key === "glass" ? 0.28 : 1;
    m.opacity = lerp(solid, GHOST[key], x);
    m.depthWrite = key !== "glass" && x < 0.35;
  }
  ARCH.edge.opacity = lerp(0.32, 0.5, x);
}
