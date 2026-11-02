"use client";

import type { PointerEvent } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { company, credentials, leadership } from "@/lib/content";
import { motionTokens, springs } from "@/lib/motion-tokens";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { STREAM_FILLS } from "@/components/shell/site";

const TILT_DEG = 7; // how far a plate leans toward the pointer
const PERSPECTIVE = 900; // px, on each plate's parent
const RIVETS = ["left-3 top-3", "right-3 top-3", "bottom-3 left-3", "bottom-3 right-3"] as const;

/**
 * Satin stainless at night: a dark steel ramp, fine horizontal brushing and a
 * raking highlight. Dark enough that mist text stays AA (~4.9:1) on the
 * lightest point and chalk ~6.9:1.
 */
const STEEL = {
  backgroundImage: [
    "repeating-linear-gradient(0deg, rgb(255 255 255 / 0.035) 0 1px, transparent 1px 3px)",
    "linear-gradient(115deg, transparent 22%, rgb(255 255 255 / 0.06) 44%, transparent 62%)",
    "linear-gradient(180deg, #3a4148 0%, #2b3137 55%, #343b42 100%)",
  ].join(", "),
  boxShadow: [
    "inset 0 1px 0 rgb(255 255 255 / 0.16)",
    "inset 0 -1px 0 rgb(0 0 0 / 0.5)",
    "0 0 0 1px rgb(0 0 0 / 0.65)",
    "0 28px 56px -28px rgb(0 0 0 / 0.9)",
  ].join(", "),
};
/** Letters cut into the plate: shadow on the upper lip, light catching the lower one. */
const ENGRAVED = { textShadow: "0 -1px 0 rgb(0 0 0 / 0.7), 0 1px 0 rgb(255 255 255 / 0.12)" };
const RIVET = {
  background: "radial-gradient(circle at 35% 30%, #eef1f3 0, #a3abb3 32%, #4d555d 74%, #2a3036 100%)",
  boxShadow: "0 1px 1px rgb(0 0 0 / 0.6), inset 0 -1px 1px rgb(0 0 0 / 0.35)",
};
const SHEEN = { background: "linear-gradient(105deg, transparent 35%, rgb(255 255 255 / 0.14) 50%, transparent 65%)" };

/**
 * Drawing title block: the company's own facts, then its leadership. Spans
 * 4/3/2/3 at lg: two columns left "outstanding”" no room and it split mid-word
 * between 1024 and ~1140px.
 */
const TITLE_BLOCK = [
  { k: "Contractor", v: company.name, span: "col-span-2 lg:col-span-4" },
  { k: "Certification", v: company.certification, span: "lg:col-span-3" },
  { k: "Established", v: String(company.founded), span: "lg:col-span-2" },
  { k: "Motto", v: `“${company.motto}”`, span: "col-span-2 lg:col-span-3" },
];

export default function Credentials() {
  return (
    <section
      id="credentials"
      aria-labelledby="credentials-title"
      className="relative overflow-hidden border-t border-hair bg-void py-24 md:py-36"
    >
      <div
        aria-hidden
        className="blueprint pointer-events-none absolute inset-0 opacity-50 [mask-image:linear-gradient(to_bottom,transparent,#000_20%,#000_70%,transparent)]"
      />
      <div className="container-x relative">
        <SectionHeader
          id="credentials-title"
          index="05"
          kicker="Credentials"
          title="Qualified to build it."
          intro={`${company.certification} — licensed in California, registered for public works, and ready for prevailing-wage projects.`}
        />

        <ul className="mt-14 grid gap-6 md:mt-20 md:grid-cols-2 lg:gap-8">
          {credentials.map((c, i) => (
            <Nameplate key={c.label} plate={c} index={i} />
          ))}
        </ul>

        <Reveal className="mt-16 md:mt-24">
          <h3 className="eyebrow text-fog">Company &amp; leadership</h3>
          <dl className="mt-5 grid grid-cols-2 gap-px border border-hair bg-hair lg:grid-cols-12">
            {TITLE_BLOCK.map((c) => (
              <div key={c.k} className={`bg-void p-5 sm:p-6 ${c.span}`}>
                <dt className="hud text-fog">{c.k}</dt>
                <dd className="mt-2 text-lg font-semibold leading-snug text-chalk">{c.v}</dd>
              </div>
            ))}
            {leadership.map((p) => (
              <div key={p.name} className="col-span-2 bg-panel p-5 sm:p-6 lg:col-span-6">
                <dt className="hud text-fog">{p.title}</dt>
                <dd className="display mt-3 text-[clamp(1.6rem,3.2vw,2.5rem)] text-chalk">{p.name}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

type Plate = (typeof credentials)[number];

/**
 * A stamped steel nameplate. It drops in from slightly oversize, leans toward
 * a mouse pointer (springed rotateX / rotateY under the parent's perspective)
 * and catches a sheen on hover. Reduced motion: no tilt, no stamp, no sweep.
 */
function Nameplate({ plate, index }: { plate: Plate; index: number }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, springs.snappy);
  const sy = useSpring(py, springs.snappy);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-TILT_DEG, TILT_DEG]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [TILT_DEG, -TILT_DEG]);

  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  };
  const handleLeave = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <motion.li
      data-reveal
      style={{ perspective: PERSPECTIVE }}
      initial={{ opacity: 0, scale: motionTokens.scale.pop }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={
        reduce
          ? { duration: motionTokens.duration.fast }
          : { duration: motionTokens.duration.slow, ease: motionTokens.easing.bounce, delay: index * motionTokens.stagger }
      }
    >
      <motion.div
        className="relative h-full overflow-hidden rounded-md px-6 py-7 sm:px-8 sm:py-9"
        style={{ ...STEEL, rotateX, rotateY }}
        initial="rest"
        animate="rest"
        whileHover="hover"
        onPointerMove={handleMove}
        onPointerLeave={handleLeave}
      >
        {RIVETS.map((pos) => (
          <span key={pos} aria-hidden className={`absolute h-2.5 w-2.5 rounded-full ${pos}`} style={RIVET} />
        ))}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={SHEEN}
          variants={{
            rest: { x: "-100%", transition: { duration: 0 } },
            hover: { x: "100%", transition: { duration: motionTokens.duration.crawl, ease: motionTokens.easing.smooth } },
          }}
        />

        <div className="relative flex items-center justify-between gap-4">
          <p className="hud text-mist">{plate.label}</p>
          <span aria-hidden className="flex gap-1">
            {STREAM_FILLS.map((fill) => (
              <span key={fill} className={`h-[3px] w-3 rounded-full ${fill}`} />
            ))}
          </span>
        </div>
        <p
          className="mono relative mt-6 text-[clamp(1.75rem,3.6vw,2.75rem)] font-semibold leading-none tracking-tight text-chalk"
          style={ENGRAVED}
        >
          {plate.value}
        </p>
        <span aria-hidden className="relative mt-6 block h-px bg-black/50 shadow-[0_1px_0_rgb(255_255_255/0.08)]" />
        <p className="relative mt-4 text-[15px] leading-snug text-mist">{plate.detail}</p>
      </motion.div>
    </motion.li>
  );
}
