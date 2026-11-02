"use client";

import { useEffect, useRef } from "react";
import { bim } from "./store";

const FACES = [
  { label: "S", t: "translateZ(var(--h))" },
  { label: "N", t: "rotateY(180deg) translateZ(var(--h))" },
  { label: "E", t: "rotateY(90deg) translateZ(var(--h))" },
  { label: "W", t: "rotateY(-90deg) translateZ(var(--h))" },
  { label: "TOP", t: "rotateX(90deg) translateZ(var(--h))" },
  { label: "", t: "rotateX(-90deg) translateZ(var(--h))" },
] as const;

/**
 * The BIM view cube: a small CSS 3D cube that turns with the WebGL camera
 * (bim.view, written by CameraRig) so you always know which face you're seeing.
 */
export default function ViewCube({ size = 46 }: { size?: number }) {
  const cube = useRef<HTMLDivElement>(null);

  // Ticks only while on screen (a display:none parent never intersects, so hidden cubes never run).
  useEffect(() => {
    const el = cube.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let raf = 0;
    const tick = () => {
      el.style.transform = `rotateX(${(-bim.view.elevation).toFixed(2)}deg) rotateY(${(-bim.view.azimuth).toFixed(2)}deg)`;
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf);
      if (e.isIntersecting) raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="relative" style={{ width: size, height: size, perspective: size * 6 }}>
      <div ref={cube} className="absolute inset-0" style={{ transformStyle: "preserve-3d", ["--h" as string]: `${size / 2}px` }}>
        {FACES.map((f) => (
          <div
            key={f.t}
            className="hud absolute inset-0 grid place-items-center border border-chalk/30 bg-panel/80 text-[9px] text-mist"
            style={{ transform: f.t, backfaceVisibility: "hidden" }}
          >
            {f.label}
          </div>
        ))}
      </div>
    </div>
  );
}
