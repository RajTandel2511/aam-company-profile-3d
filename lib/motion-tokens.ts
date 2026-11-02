/**
 * The motion system's single source of values (motion-foundations). Components
 * import durations, easings, distances, scales and springs from here — never
 * inline numbers.
 */
export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.18,
    normal: 0.35,
    slow: 0.6,
    crawl: 1.0,
  },
  easing: {
    smooth: [0.22, 1, 0.36, 1],
    sharp: [0.4, 0, 0.2, 1],
    bounce: [0.34, 1.56, 0.64, 1],
    linear: [0, 0, 1, 1],
  },
  distance: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 48,
  },
  scale: {
    subtle: 0.98,
    press: 0.95,
    pop: 1.04,
  },
  /** Stagger interval for lists and word reveals — inside the 0.05–0.10 s rule. */
  stagger: 0.07,
  /** Per-character stagger for split-text headlines (characters, not list items). */
  charStagger: 0.022,
} as const;

/** anime.js speaks milliseconds and named eases; these map the same tokens onto it. */
export const animeTokens = {
  ease: { smooth: "outExpo", sharp: "inOutQuart", settle: "outBack(1.4)" },
  ms: (seconds: number) => Math.round(seconds * 1000),
} as const;

export const springs = {
  snappy: { type: "spring", stiffness: 300, damping: 30 },
  gentle: { type: "spring", stiffness: 120, damping: 14 },
  bouncy: { type: "spring", stiffness: 400, damping: 10 },
  instant: { type: "spring", stiffness: 600, damping: 35 },
  release: { type: "spring", stiffness: 200, damping: 20, restDelta: 0.001 },
  /** critically damped (no overshoot): scroll-scrubbed values that must track the scroll, not bounce past it */
  follow: { type: "spring", stiffness: 170, damping: 26, restDelta: 0.0005 },
} as const;

/** Reveal-on-scroll defaults. Elements carry data-reveal so a <noscript> rule can show them without JS. */
export const reveal = {
  initial: { opacity: 0, y: motionTokens.distance.lg },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: motionTokens.duration.slow, ease: motionTokens.easing.smooth },
} as const;
