import * as THREE from "three";
import { clamp, lerp } from "@/lib/timing";
import { PENTHOUSE } from "../../geometry";
import { STORY, ease } from "../../timeline";

/**
 * Shared by Finale (draws the band) and Service (its badges relight as the band
 * passes). Pure functions of bim.story.
 */

/** The finale's band of light: its leading edge rises from grade to clear the roof equipment. */
export const BAND = { y0: 0.3, y1: PENTHOUSE.top + 0.6, h: 3, soft: 1.2 } as const;

/** Height of the band's leading edge at story progress p. */
export const bandY = (p: number): number => lerp(BAND.y0, BAND.y1, ease(p, STORY.finale.running));

/** 0..1 — how far the band's leading edge has passed height y (soft across BAND.soft). */
export const bandPassed = (p: number, y: number): number => clamp((bandY(p) - y) / BAND.soft + 0.5);

/**
 * Bake a 0..1 brightness per vertex into a colour attribute. With additive
 * blending black is clear, so this is a gradient without a shader or texture.
 */
export function glowGradient<G extends THREE.BufferGeometry>(geo: G, f: (x: number, y: number, z: number) => number): G {
  const pos = geo.getAttribute("position");
  const rgb = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) rgb.fill(f(pos.getX(i), pos.getY(i), pos.getZ(i)), i * 3, i * 3 + 3);
  geo.setAttribute("color", new THREE.BufferAttribute(rgb, 3));
  return geo;
}
