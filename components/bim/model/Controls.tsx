"use client";

import { useRef, type ElementRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import { easeOutBack, lerp } from "@/lib/timing";
import { CONTROLS, FLOORS, ROOF_Y, fanRoute, rtuRoute, sensorAt, sensorRoutes, type V3 } from "../geometry";
import { COLORS, GLOW, MEP } from "../materials";
import { Pulses, Tag, polyLength } from "../kit";
import { STORY, arrive, ease, stagger, win, type Window } from "../timeline";
import { bim } from "../store";
import { dashPieces, sinceArrival, type Dashes } from "./signals/net";

/**
 * Chapter 04 — EMS & CONTROLS. EMS-1 extrudes out of the core wall at L1 and powers
 * up, a dashed controls riser climbs to the roof, data lines branch to a thermostat on
 * column C2 on every floor and to the rooftop unit and exhaust fan, then pulses run out
 * and back so the network visibly talks (device LEDs blink as data lands).
 * Pure function of bim.story — pulses and blinks ride bim.time — so scrubbing back
 * un-builds it exactly. Thermostat readouts are illustrative (the DOM legend says so).
 */

const S = STORY.controls;
const P = CONTROLS.panel;

/* linework — dashed reads as "controls" in a BIM legend */
const DASH = 0.5;
const GAP = 0.3;
const LINE_W = 1.6;
/** gapSize while drawing on: longer than any route, so the dash test means "drawn up to dashSize" */
const DRAW_GAP = 1e3;
/** covers float drift between our dash sum and the GPU's, so t = 1 shows the last dash whole */
const DRAW_PAD = 0.05;

/* data pulses — small and quick; each loop runs panel -> device -> panel */
const PULSES = 2;
const SPEED = 11;
const PULSE_R = 0.06;
const LED_R = 0.04;
const BLINK_S = 0.35;
const BLINK_GAIN = 0.9;

/** Illustrative thermostat readouts, L1..L4. */
const READ_F = [72, 71, 72, 70] as const;

const PANEL_IN: Window = [S.panel[0], lerp(S.panel[0], S.panel[1], 0.7)];
const POWER_ON: Window = [lerp(S.panel[0], S.panel[1], 0.55), S.panel[1]];
/** Controls tags clear away as the maintenance chapter starts. */
const TAGS_OUT: Window = [STORY.maintenance.stops[0][0] - 0.02, STORY.maintenance.stops[0][0]];

/** The riser: panel top straight up to the roof — every route climbs it. */
const RISER = dashPieces(rtuRoute.slice(0, 2), DASH, GAP);
const fanEnd = fanRoute[fanRoute.length - 1];
const rtuBox = CONTROLS.rtuBox;
const EMS_TAG: V3 = [P.x + P.d / 2, P.y + P.h / 2 + 0.1, P.z];

/** One device per route end: L1..L4 thermostats, the RTU controller, a junction box at the fan. */
const DEVICES: readonly { box: V3; size: V3; led: V3 }[] = [
  ...sensorRoutes.map((_, i) => {
    const [x, y, z] = sensorAt(i);
    return { box: [x, y, z] as V3, size: [0.2, 0.28, 0.07] as V3, led: [x, y + 0.07, z + 0.05] as V3 };
  }),
  { box: [rtuBox.x, rtuBox.y + 0.25, rtuBox.z + 0.03], size: [0.42, 0.5, 0.12], led: [rtuBox.x, rtuBox.y + 0.38, rtuBox.z - 0.04] },
  { box: [fanEnd[0] - 0.1, ROOF_Y + 0.13, fanEnd[2]], size: [0.2, 0.26, 0.2], led: [fanEnd[0] - 0.1, ROOF_Y + 0.3, fanEnd[2]] },
];

/** Every data route in draw order (L1..L4, RTU, fan) with its windows. */
const NET = [...sensorRoutes, rtuRoute, fanRoute].map((route, k, all) => {
  const line = stagger(S.lines, k, all.length, 0.5);
  const device: Window = k < FLOORS ? stagger(S.sensors, k, FLOORS, 0.5) : [line[1] - 0.004, line[1] + 0.006];
  const on = Math.max(S.run, device[1]); // data flows only once the device is there
  return {
    /** riser tee -> device; the shared riser draws on separately */
    branch: dashPieces(route.slice(1), DASH, GAP),
    line,
    device,
    live: [on, on + 0.012] as Window,
    tag: [device[1] - 0.004, device[1] + 0.008] as Window,
    /** panel -> device -> panel: a poll and its reply */
    loop: [...route, ...route.slice(0, -1).reverse()],
    reach: polyLength(route),
  };
});

const PANEL_BOX = new THREE.BoxGeometry(P.d, P.h, P.w);
const PANEL_EDGES = new THREE.EdgesGeometry(PANEL_BOX);
/** faces +x, out of the wall */
const SCREEN = new THREE.PlaneGeometry(0.5, 0.34).rotateY(Math.PI / 2);
const SCREEN_LIT = new THREE.Color(COLORS.supplyGlow).multiplyScalar(1.15);
const screenMat = new THREE.MeshBasicMaterial({
  color: 0x000000,
  toneMapped: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
});
/** status LEDs in the three streams' colours: supply, exhaust / OA, return */
const STATUS = [GLOW.supply, GLOW.exhaust, GLOW.ret];
const BEAD = new THREE.SphereGeometry(1, 12, 8);
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const dummy = new THREE.Object3D();

type LineObject = ElementRef<typeof Line>;

/** A dashed signal line that draws on as draw() goes 0 -> 1. */
function Wire({ dashes, draw }: { dashes: Dashes; draw: () => number }) {
  const ref = useRef<LineObject>(null);
  useFrame(() => {
    const line = ref.current;
    if (!line) return;
    const t = draw();
    line.visible = t > 0;
    line.material.dashSize = (dashes.drawn + DRAW_PAD) * t;
  });
  return (
    <Line
      ref={ref}
      points={dashes.points}
      segments
      dashed
      dashScale={1}
      dashSize={0}
      gapSize={DRAW_GAP}
      color={COLORS.signal}
      lineWidth={LINE_W}
    />
  );
}

export default function Controls() {
  const panel = useRef<THREE.Group>(null);
  const status = useRef<THREE.Group>(null);
  const boxes = useRef<THREE.InstancedMesh>(null);
  const beads = useRef<THREE.InstancedMesh>(null);
  // ponytail: mirrors kit Pulses' private low-quality halving so blinks land on drawn dots;
  // export the count from kit if that rule ever changes, or the blinks drift off the pulses.
  const dots =bim.quality === "low" ? Math.max(1, Math.ceil(PULSES / 2)) : PULSES;

  useFrame(() => {
    const p = bim.story;

    // EMS-1 grows out of the wall, then the screen and status LEDs come on
    const g = panel.current;
    if (g) {
      const a = arrive(p, PANEL_IN);
      g.visible = a > 0.001;
      g.scale.set(Math.max(0.001, a), lerp(0.6, 1, a), lerp(0.6, 1, a));
    }
    const on = win(p, POWER_ON);
    screenMat.color.copy(SCREEN_LIT).multiplyScalar(on);
    status.current?.scale.setScalar(on);

    // devices pop onto their mounts; each LED flashes as a pulse lands on it
    const bx = boxes.current;
    const bd = beads.current;
    if (!bx || !bd) return;
    for (let k = 0; k < NET.length; k++) {
      const n = NET[k];
      const d = DEVICES[k];
      const placed = easeOutBack(win(p, n.device));
      dummy.position.set(d.box[0], d.box[1], d.box[2]);
      dummy.scale.set(d.size[0] * placed, d.size[1] * placed, d.size[2] * placed);
      dummy.updateMatrix();
      bx.setMatrixAt(k, dummy.matrix);

      const live = bim.reduced ? 0 : win(p, n.live);
      const flash = live * Math.max(0, 1 - sinceArrival(bim.time, SPEED, n.reach * 2, dots, n.reach) / BLINK_S);
      dummy.position.set(d.led[0], d.led[1], d.led[2]);
      dummy.scale.setScalar(LED_R * placed * (1 + BLINK_GAIN * flash));
      dummy.updateMatrix();
      bd.setMatrixAt(k, dummy.matrix);
    }
    bx.instanceMatrix.needsUpdate = true;
    bd.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {/* EMS-1 — group origin on the core wall face, so it extrudes out toward +x */}
      <group ref={panel} position={[P.x - P.d / 2, P.y, P.z]} visible={false}>
        <mesh geometry={PANEL_BOX} material={MEP.equipment} position-x={P.d / 2} />
        <lineSegments geometry={PANEL_EDGES} material={MEP.edge} position-x={P.d / 2} />
        <mesh geometry={SCREEN} material={screenMat} position={[P.d + 0.01, 0.2, 0]} />
        <group ref={status} position={[P.d + 0.012, -0.16, 0]} scale={0}>
          {STATUS.map((m, i) => (
            <mesh key={m.uuid} geometry={BEAD} material={m} position-z={(i - 1) * 0.12} scale={0.035} />
          ))}
        </group>
      </group>

      <Wire dashes={RISER} draw={() => ease(bim.story, S.riser)} />
      {NET.map((n, k) => (
        <Wire key={k} dashes={n.branch} draw={() => ease(bim.story, n.line)} />
      ))}

      <instancedMesh ref={boxes} args={[UNIT_BOX, MEP.equipment, DEVICES.length]} frustumCulled={false} />
      <instancedMesh ref={beads} args={[BEAD, GLOW.signal, DEVICES.length]} frustumCulled={false} />

      {NET.map((n, k) => (
        <Pulses
          key={k}
          path={n.loop}
          count={PULSES}
          speed={SPEED}
          size={PULSE_R}
          material={GLOW.signal}
          gate={() => win(bim.story, n.live)}
        />
      ))}

      <Tag position={EMS_TAG} show={() => win(bim.story, POWER_ON) * (1 - win(bim.story, TAGS_OUT))}>
        EMS-1
      </Tag>
      {NET.slice(0, FLOORS).map((n, i) => (
        <Tag key={i} position={DEVICES[i].box} show={() => win(bim.story, n.tag) * (1 - win(bim.story, TAGS_OUT))}>
          T-STAT L{i + 1} · {READ_F[i]}°F
        </Tag>
      ))}
    </group>
  );
}
