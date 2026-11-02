"use client";

import { Component, useEffect, useState, type ReactNode } from "react";

/**
 * Keeps a WebGL failure (no WebGL2, blocklisted GPU, lost context, a 3D chunk
 * that fails to load) from taking the whole page down: the canvas simply isn't
 * there and every word of the page still is. Error boundaries have to be
 * classes — React has no hook for getDerivedStateFromError.
 */
export class GLBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // intentionally swallowed: the 3D layers are decoration over complete HTML content
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}

let cached: boolean | null = null;

/** True once we know the browser can open a WebGL2 context (three r173 requires it). */
export function useWebGL2(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (cached === null) {
      try {
        const gl = document.createElement("canvas").getContext("webgl2");
        cached = !!gl;
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        cached = false;
      }
    }
    setOk(cached);
  }, []);
  return ok;
}
