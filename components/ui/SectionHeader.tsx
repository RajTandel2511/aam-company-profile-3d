"use client";

import { motion, useReducedMotion } from "motion/react";
import { motionTokens } from "@/lib/motion-tokens";

type Props = {
  /** id for the h2 — the section's aria-labelledby points here */
  id: string;
  /** two-digit section index, e.g. "03" */
  index: string;
  /** short mono kicker after the index, e.g. "Shop · In-house fabrication" */
  kicker: string;
  title: string;
  intro?: string;
  className?: string;
};

/**
 * The one section header used across the page: a mono index + kicker, a heavy
 * display title whose words rise out of a mask one by one, and an optional intro.
 */
export function SectionHeader({ id, index, kicker, title, intro, className = "" }: Props) {
  const reduce = useReducedMotion();
  const words = title.split(" ");
  const fade = reduce
    ? { duration: motionTokens.duration.fast }
    : { duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth };

  return (
    <header className={className}>
      <motion.p
        data-reveal
        className="eyebrow text-fog"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={fade}
      >
        <span className="text-blue-glow">[ {index} ]</span> {kicker}
      </motion.p>
      <motion.h2
        id={id}
        className="display mt-5 max-w-[16ch] text-[clamp(2.4rem,6vw,5.25rem)] text-chalk"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={{ visible: { transition: { staggerChildren: reduce ? 0 : motionTokens.stagger } } }}
      >
        {words.map((w, i) => (
          <span key={`${w}-${i}`} className="inline-block overflow-hidden pb-[0.1em] align-bottom">
            <motion.span
              data-reveal
              className="inline-block"
              variants={{ hidden: { y: "105%", opacity: 0 }, visible: { y: "0%", opacity: 1, transition: fade } }}
            >
              {w}
            </motion.span>
            {i < words.length - 1 ? " " : null}
          </span>
        ))}
      </motion.h2>
      {intro && (
        <motion.p
          data-reveal
          className="mt-6 max-w-xl text-[17px] leading-relaxed text-mist md:text-lg"
          initial={{ opacity: 0, y: motionTokens.distance.md }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={reduce ? fade : { ...fade, delay: motionTokens.duration.normal }}
        >
          {intro}
        </motion.p>
      )}
    </header>
  );
}
