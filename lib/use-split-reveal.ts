"use client";

import { useEffect, useRef, type RefObject } from "react";
import { animate, splitText, stagger, type JSAnimation, type TextSplitter } from "animejs";
import { motionConfig } from "./motion-config";
import { animeTokens, motionTokens } from "./motion-tokens";

type Options = { delay?: number; play?: boolean };

/**
 * anime.js character reveal. Splits the element's text into words and clipped
 * characters (accessible: anime keeps a hidden full-text copy and aria-hides the
 * pieces) and lifts the characters in with a stagger every time `play` turns
 * true. Pair the element with data-split so CSS hides it until it is split.
 * Reduced motion: never split, shown as is.
 */
export function useSplitReveal(ref: RefObject<HTMLElement | null>, { delay = 0, play = true }: Options = {}) {
  const split = useRef<TextSplitter | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (motionConfig.prefersReduced()) {
      el.dataset.splitReady = "";
      return;
    }
    const s = splitText(el, { words: true, chars: { wrap: "clip" }, accessible: true });
    for (const c of s.chars as HTMLElement[]) c.style.transform = "translateY(110%)";
    split.current = s;
    el.dataset.splitReady = "";
    return () => {
      s.revert();
      split.current = null;
    };
  }, [ref]);

  useEffect(() => {
    const s = split.current;
    if (!s) return;
    const chars = s.chars as HTMLElement[];
    if (!play) {
      for (const c of chars) c.style.transform = "translateY(110%)";
      return;
    }
    const anim: JSAnimation = animate(chars, {
      y: ["110%", "0%"],
      duration: animeTokens.ms(motionTokens.duration.crawl),
      delay: stagger(animeTokens.ms(motionTokens.charStagger), { start: animeTokens.ms(delay) }),
      ease: animeTokens.ease.smooth,
    });
    return () => {
      anim.cancel();
    };
  }, [play, delay]);
}
