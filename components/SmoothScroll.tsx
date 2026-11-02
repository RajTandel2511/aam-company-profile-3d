"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { motionConfig } from "@/lib/motion-config";
import { scrollToTarget, setLenis } from "@/lib/smooth-scroll";

/**
 * Inertial smooth scrolling for the whole page (Lenis). Wheel steps become one
 * continuous glide, so the scroll-scrubbed model moves without stutter. It keeps
 * native scroll positions, so position: sticky, IntersectionObserver and
 * motion's useScroll work unchanged. Touch keeps the device's own momentum.
 * Off for reduced motion. Pauses itself while any overlay locks body scroll.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (motionConfig.prefersReduced()) return;
    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.085,
      wheelMultiplier: 0.95,
      // let the lightbox, menus and overflowing panels scroll on their own
      prevent: (node) => node.closest?.("[data-lenis-prevent], [role='dialog']") != null,
    });
    setLenis(lenis);

    // In-page links glide (and move focus) instead of jumping. Lenis's own anchor option lets
    // the browser's jump fire first, so we take the click ourselves. scroll-padding-top clears the nav.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href^='#']");
      const hash = link?.getAttribute("href");
      if (!hash || hash.length < 2 || !document.querySelector(hash)) return;
      e.preventDefault();
      scrollToTarget(hash);
    };
    document.addEventListener("click", onClick);

    // Overlays (mobile menu, lightbox) lock scroll with body overflow:hidden — follow them.
    const sync = () => (document.body.style.overflow === "hidden" ? lenis.stop() : lenis.start());
    const watch = new MutationObserver(sync);
    watch.observe(document.body, { attributes: true, attributeFilter: ["style"] });

    return () => {
      document.removeEventListener("click", onClick);
      watch.disconnect();
      setLenis(null);
      lenis.destroy();
    };
  }, []);
  return null;
}
