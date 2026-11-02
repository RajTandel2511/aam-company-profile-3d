"use client";

import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { clamp, easeInOutCubic, lerp, seg } from "@/lib/timing";
import type { V3 } from "./geometry";
import { bim } from "./store";
import { CHAPTERS, chapterAt, type ChapterId } from "./timeline";

type Shot = { pos: V3; target: V3 };

/**
 * One camera shot per chapter (position, look-at target), in model metres.
 * The rig orbits between them in spherical coordinates around the moving
 * target, so moves arc around the building instead of cutting through it.
 */
const SHOTS: Record<ChapterId | "hero", Shot> = {
  hero: { pos: [57, 31, 68], target: [0, 8.5, 0] },
  model: { pos: [46, 27, 55], target: [0, 9, 0] },
  sheetmetal: { pos: [42, 25, 38], target: [9, 11.5, 2] },
  hvac: { pos: [8, 18, 53], target: [0, 9, 0] },
  exhaust: { pos: [42, 34, 23], target: [8, 14.5, -4] },
  controls: { pos: [18, 13, 45], target: [-4, 7.5, -3] },
  maintenance: { pos: [-30, 33, 40], target: [-2, 12, -2] },
  finale: { pos: [50, 32, 60], target: [0, 10, 0] },
};
/** Share of each chapter spent travelling from the previous shot; the rest holds. */
const TRAVEL = 0.45;

type Orbit = { r: number; phi: number; theta: number; t: THREE.Vector3 };

const scratch = new THREE.Vector3();
const toOrbit = ({ pos, target }: Shot): Orbit => {
  scratch.set(pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]);
  const s = new THREE.Spherical().setFromVector3(scratch);
  return { r: s.radius, phi: s.phi, theta: s.theta, t: new THREE.Vector3(...target) };
};
const ORBITS = Object.fromEntries(Object.entries(SHOTS).map(([k, v]) => [k, toOrbit(v)])) as Record<ChapterId | "hero", Orbit>;

const lerpAngle = (a: number, b: number, t: number) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

function mix(a: Orbit, b: Orbit, t: number, out: Orbit) {
  out.r = lerp(a.r, b.r, t);
  out.phi = lerp(a.phi, b.phi, t);
  out.theta = lerpAngle(a.theta, b.theta, t);
  out.t.lerpVectors(a.t, b.t, t);
  return out;
}

/**
 * While a shot holds, the camera keeps gliding — a slow orbit and a gentle
 * push-in tied to scroll — so every bit of scrolling moves the picture and
 * nothing feels parked. The finale sweeps wider.
 */
const DRIFT = { theta: 0.17, push: 0.07, lift: 0.03 } as const;
const gainOf = (id: ChapterId) => (id === "finale" ? 2.2 : 1);

function drifted(base: Orbit, hold: number, gain: number, out: Orbit) {
  out.r = base.r * (1 - DRIFT.push * hold * gain);
  out.phi = base.phi - DRIFT.lift * hold * gain;
  out.theta = base.theta + (hold - 0.5) * DRIFT.theta * gain;
  out.t.copy(base.t);
  return out;
}

const heroNow: Orbit = { r: 0, phi: 0, theta: 0, t: new THREE.Vector3() };
const now: Orbit = { r: 0, phi: 0, theta: 0, t: new THREE.Vector3() };
const fromShot: Orbit = { r: 0, phi: 0, theta: 0, t: new THREE.Vector3() };
const toShot: Orbit = { r: 0, phi: 0, theta: 0, t: new THREE.Vector3() };
const sph = new THREE.Spherical();
const parallax = { x: 0, y: 0 };

/**
 * Drives the camera from the clocks: an establishing crane-down during the 4D
 * sequence, a slow sway in the hero, then one shot per chapter. On wide screens
 * the image is shifted right (the copy panel sits left); on portrait screens it
 * is shifted up (copy sits below) and the lens widens to keep the building whole.
 */
export default function CameraRig() {
  useFrame(({ camera, size }, delta) => {
    const cam = camera as THREE.PerspectiveCamera;
    const dt = Math.min(delta, 0.1);
    const intro = easeInOutCubic(bim.intro);

    // Hero: establishing shot settles as the building assembles, then sways.
    const hero = ORBITS.hero;
    heroNow.r = hero.r * lerp(1.22, 1, intro);
    heroNow.phi = hero.phi * lerp(0.82, 1, intro);
    heroNow.theta = hero.theta + (bim.reduced ? 0 : Math.sin(bim.time * 0.11) * 0.09 - (1 - intro) * 0.35);
    heroNow.t.copy(hero.t);
    // Scrolling the hero away carries the camera halfway to the first story shot.
    mix(heroNow, ORBITS.model, 0.5 * easeInOutCubic(bim.hero), heroNow);

    if (bim.reduced) {
      mix(ORBITS.finale, ORBITS.finale, 0, now);
    } else {
      const i = chapterAt(bim.story);
      const { id, range } = CHAPTERS[i];
      const [a, b] = range;
      const arrive = a + (b - a) * TRAVEL;
      const t = easeInOutCubic(seg(bim.story, a, arrive));
      const hold = seg(bim.story, arrive, b);
      // travel from where the previous shot's drift ended to where this one's begins, then drift on
      const from = i === 0 ? heroNow : drifted(ORBITS[CHAPTERS[i - 1].id], 1, gainOf(CHAPTERS[i - 1].id), fromShot);
      drifted(ORBITS[id], hold, gainOf(id), toShot);
      mix(from, toShot, t, now);
      // a breath of idle drift on top
      now.theta += Math.sin(bim.time * 0.07) * 0.025 * bim.hero;
    }

    // Pointer parallax, eased.
    const k = 1 - Math.exp(-3 * dt);
    parallax.x += (bim.pointer.x - parallax.x) * k;
    parallax.y += (bim.pointer.y - parallax.y) * k;

    // Lens and distance for the viewport shape.
    const aspect = size.width / Math.max(1, size.height);
    const fov = aspect >= 1 ? 30 : 30 + (1 - aspect) * 32;
    const reach = aspect >= 1.25 ? 1 : 1 + (1.25 - aspect) * 0.62;
    if (Math.abs(cam.fov - fov) > 0.01) cam.fov = fov;

    // Frame around the copy: right-shift on desktop, up-shift on portrait.
    const story = clamp(bim.hero);
    const wide = size.width >= 1024;
    // portrait hero: a smaller model riding in the top third, clear of the headline below it
    const portraitHero = aspect < 1 ? lerp(1.14, 1, story) : 1;

    sph.set(now.r * reach * portraitHero, clamp(now.phi - parallax.y * 0.025, 0.2, 1.52), now.theta - parallax.x * 0.04);
    cam.position.setFromSpherical(sph).add(now.t);
    cam.lookAt(now.t);

    const sx = wide ? size.width * lerp(0.19, 0.16, story) : 0;
    const sy = wide ? 0 : size.height * lerp(0.28, 0.17, story);
    cam.setViewOffset(size.width, size.height, -sx, sy, size.width, size.height);

    bim.view.azimuth = THREE.MathUtils.radToDeg(sph.theta);
    bim.view.elevation = 90 - THREE.MathUtils.radToDeg(sph.phi);
  });
  return null;
}
