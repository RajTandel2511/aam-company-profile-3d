"use client";

import type Lenis from "lenis";

/**
 * Holder for the page's Lenis instance (created by components/SmoothScroll.tsx)
 * plus one helper every in-page jump uses, so links glide with the same inertia
 * as the wheel and still work when Lenis is off (reduced motion, no JS yet).
 */

let instance: Lenis | null = null;

export function setLenis(lenis: Lenis | null) {
  instance = lenis;
}

export function getLenis(): Lenis | null {
  return instance;
}

/**
 * Scroll to an element or "#id" — smooth through Lenis when it is running,
 * native otherwise — then move keyboard focus there (focus: false to skip).
 * Both paths honour scroll-padding-top on <html> (globals.css), which clears
 * the fixed nav, so no extra offset is passed.
 */
export function scrollToTarget(target: string | HTMLElement, { focus = true }: { focus?: boolean } = {}) {
  const el = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
  if (!el) return;
  const land = () => {
    if (!focus) return;
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };
  if (instance && !instance.isStopped) {
    instance.scrollTo(el, { onComplete: land });
    return;
  }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  land();
}
