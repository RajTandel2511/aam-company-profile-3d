"use client";

import { useEffect, useRef, useState } from "react";
import { createTimeline, stagger } from "animejs";
import { animeTokens, motionTokens } from "@/lib/motion-tokens";
import { useSplitReveal } from "@/lib/use-split-reveal";

const ROWS = 7;
const COLS = { wide: 24, narrow: 12 } as const;
const TILE = "#14181D";
const STREAMS = ["#0078C0", "#00A848", "#EA362A"] as const; // logo blue, green, red
const ms = animeTokens.ms;

/**
 * The hand-off from the model to the shop, built on anime.js's grid stagger.
 * A floor of flat sheet-metal blanks lands from the centre out, then the logo's
 * three streams wash across it — blue from the left, green from the centre,
 * red from the right — before the caption rises. Plays once, on first view.
 * Reduced motion: the blanks are simply there.
 */
export default function GridWipe() {
  const root = useRef<HTMLDivElement>(null);
  const caption = useRef<HTMLParagraphElement>(null);
  const [play, setPlay] = useState(false);
  useSplitReveal(caption, { play, delay: motionTokens.duration.crawl });

  useEffect(() => {
    const el = root.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        setPlay(true);
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const el = root.current;
    if (!play || !el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const cols = window.innerWidth < 768 ? COLS.narrow : COLS.wide;
    const tiles = Array.from(el.querySelectorAll<HTMLElement>("[data-tile]")).slice(0, cols * ROWS);
    const grid = [cols, ROWS];
    const wave = (color: string, from: "first" | "center" | "last") => ({
      backgroundColor: [
        { to: color, duration: ms(motionTokens.duration.fast) },
        { to: TILE, duration: ms(motionTokens.duration.slow) },
      ],
      delay: stagger(ms(motionTokens.charStagger), { grid, from }),
    });
    const tl = createTimeline({ defaults: { ease: animeTokens.ease.smooth } })
      .add(tiles, {
        scale: [0, 1],
        rotate: ["-90deg", "0deg"],
        opacity: [0, 1],
        duration: ms(motionTokens.duration.crawl),
        delay: stagger(ms(motionTokens.charStagger * 1.4), { grid, from: "center" }),
      })
      .add(tiles, wave(STREAMS[0], "first"), `-=${ms(motionTokens.duration.slow)}`)
      .add(tiles, wave(STREAMS[1], "center"), `-=${ms(motionTokens.duration.crawl)}`)
      .add(tiles, wave(STREAMS[2], "last"), `-=${ms(motionTokens.duration.crawl)}`);
    return () => {
      tl.revert();
    };
  }, [play]);

  return (
    <section aria-labelledby="gridwipe-caption" className="relative overflow-hidden bg-void py-20 md:py-28">
      <div ref={root} className="container-x">
        <div aria-hidden className="grid grid-cols-12 gap-1.5 md:grid-cols-[repeat(24,minmax(0,1fr))] md:gap-2">
          {Array.from({ length: COLS.wide * ROWS }, (_, i) => (
            <span
              key={i}
              data-tile
              className={`aspect-square rounded-[2px] border border-chalk/[0.07] ${i >= COLS.narrow * ROWS ? "max-md:hidden" : ""}`}
              style={{ backgroundColor: TILE }}
            />
          ))}
        </div>
        <p id="gridwipe-caption" ref={caption} data-split className="display mx-auto mt-12 max-w-[22ch] text-center text-[clamp(1.6rem,3.6vw,3rem)] text-chalk">
          Every duct in that model starts as a flat sheet in our shop.
        </p>
      </div>
    </section>
  );
}
