"use client";

import { useSyncExternalStore } from "react";

/**
 * The site-wide "Pause motion" switch (WCAG 2.2.2): one flag every ambient loop
 * reads — airflow and data pulses, the map's particles, the shop model's spin,
 * the contact streams. Scroll-driven motion still follows the visitor's scroll.
 * The choice is remembered per browser (best effort: storage can be blocked).
 */

const KEY = "aam-motion-paused";
const listeners = new Set<() => void>();
let paused = false;
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    paused = window.localStorage.getItem(KEY) === "1";
  } catch {
    paused = false;
  }
}

/** Current value, for render loops (useFrame, rAF) that must not re-render. */
export function getMotionPaused(): boolean {
  load();
  return paused;
}

export function setMotionPaused(next: boolean) {
  load();
  paused = next;
  try {
    window.localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // storage blocked (private mode): the switch still works for this visit
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React binding. The server snapshot is false, so markup always hydrates as "playing". */
export function useMotionPaused(): boolean {
  return useSyncExternalStore(subscribe, getMotionPaused, () => false);
}
