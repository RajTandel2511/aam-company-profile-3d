"use client";

import dynamic from "next/dynamic";
import { GLBoundary, useWebGL2 } from "@/components/GLBoundary";

// three / R3F never run on the server: the stage mounts after hydration.
const BimStage = dynamic(() => import("./BimStage"), { ssr: false });

export default function StageLoader() {
  const webgl = useWebGL2();
  if (!webgl) return null;
  return (
    <GLBoundary>
      <BimStage />
    </GLBoundary>
  );
}
