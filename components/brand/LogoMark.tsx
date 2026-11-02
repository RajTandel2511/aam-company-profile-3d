import { useId } from "react";
import { easeInOutCubic, easeOutCubic, seg } from "@/lib/timing";

/**
 * Vector AAM mark — grey ring + three airflow arrows — traced from
 * public/brand/aam-logo-vertical.png (coordinates are that PNG's pixels, 673×511).
 * Each band is a ribbon: a darker fold turns under at its left end and tucks
 * BEHIND the ring; the front face crosses IN FRONT of the ring on both sides and
 * casts a shadow strip on the ring's right side.
 */

const RING = { cx: 338, cy: 182, r: 162, width: 38 } as const;
const R_OUT = RING.r + RING.width / 2;
const R_IN = RING.r - RING.width / 2;
const SWEEP_X = 112; // left edge of the left-to-right reveal
const SHADOW_DY = 13;

// Fold = brand colour × 0.8, the same darkening the PNG uses.
const BANDS = [
  {
    color: "var(--blue)",
    fold: "#00609A",
    foldD: "M122 135L168 166L168 185L130 158.7Q123 152 122 148Z",
    shaft:
      "M122 133.4Q122 131.4 124 131.4C269.6 119.7 415.2 128.5 560.8 165l2.9 0.7L558.5 187.6L555.6 186.9C411.7 149.1 267.9 147.9 124 146.7Q122 146.7 122 144.7Z",
    head: "M560.8 165L563.5 153.8L597 185.3L552.8 198.2L555.6 186.9Z",
    neck: [558.2, 176],
  },
  {
    color: "var(--green)",
    fold: "#00863A",
    foldD: "M122 166.7L168 189.7L168 206L130 186.2Q123 181 122 177Z",
    shaft:
      "M122 162.5Q122 160.5 124 160.5C276.5 155.5 429.1 174.2 581.6 213.2l2.9 0.7L579.3 235.7L576.4 235C425.6 195.2 274.8 175.2 124 175.7Q122 175.7 122 173.7Z",
    head: "M581.6 213.2L584.5 200.8L618 232.4L573.8 246.2L576.4 235Z",
    neck: [579, 224.1],
  },
  {
    color: "var(--red)",
    fold: "#BB2B22",
    foldD: "M122 195.4L168 211.9L168 234.1L130 214.1Q123 209 122 205Z",
    shaft:
      "M122 191.1Q122 189.1 124 189.1C261.9 185.2 399.9 201.6 537.8 242.3l2.9 0.7L535.4 264.7L532.5 264C396.3 220.8 260.2 205.3 124 203.6Q122 203.6 122 201.6Z",
    head: "M537.8 242.3L540.8 229.8L574 261.2L529.8 275.2L532.5 264Z",
    neck: [535.2, 253.2],
  },
] as const;

// Right half of the ring as a filled annulus — shadows live only on the ring.
const RIGHT_ANNULUS = `M${RING.cx} ${RING.cy - R_OUT}A${R_OUT} ${R_OUT} 0 0 1 ${RING.cx} ${RING.cy + R_OUT}L${RING.cx} ${RING.cy + R_IN}A${R_IN} ${R_IN} 0 0 0 ${RING.cx} ${RING.cy - R_IN}Z`;

/** Tip positions (same coordinate space) — the hero's streams leave from here. */
export const LOGO_TIPS = [
  [597, 185.3],
  [618, 232.4],
  [574, 261.2],
] as const;
/** Centre of each band's left end — the hero's streams arrive here. */
export const LOGO_TAILS = [
  [122, 139],
  [122, 168],
  [122, 196.4],
] as const;
export const LOGO_VIEWBOX = "112 -6 516 376";

type Props = { progress?: number; className?: string; title?: string };

export default function LogoMark({ progress = 1, className, title }: Props) {
  const uid = useId().replace(/:/g, "");
  const ringP = easeInOutCubic(seg(progress, 0, 0.4));
  const sweeps = BANDS.map((_, i) => easeInOutCubic(seg(progress, 0.3 + i * 0.075, 0.7 + i * 0.075)));
  const heads = BANDS.map((_, i) => easeOutCubic(seg(progress, 0.8 + i * 0.05, 0.9 + i * 0.05)));
  const labelled = Boolean(title);

  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      className={className}
      role={labelled ? "img" : undefined}
      aria-label={title}
      aria-hidden={labelled ? undefined : true}
    >
      {title && <title>{title}</title>}
      <defs>
        {BANDS.map((b, i) => (
          <clipPath key={i} id={`${uid}s${i}`}>
            {/* scaleX about SWEEP_X: a transform, never a width animation */}
            <rect
              x={SWEEP_X}
              y={90}
              width={b.neck[0] + 8 - SWEEP_X}
              height={200}
              transform={`matrix(${sweeps[i]} 0 0 1 ${SWEEP_X * (1 - sweeps[i])} 0)`}
            />
          </clipPath>
        ))}
        <clipPath id={`${uid}ring`}>
          <path d={RIGHT_ANNULUS} />
        </clipPath>
      </defs>

      {/* folds: behind the ring */}
      {BANDS.map((b, i) => (
        <path key={i} d={b.foldD} fill={b.fold} clipPath={`url(#${uid}s${i})`} />
      ))}

      <circle
        cx={RING.cx}
        cy={RING.cy}
        r={RING.r}
        fill="none"
        stroke="var(--graphite)"
        strokeWidth={RING.width}
        pathLength={1}
        strokeDasharray={ringP < 1 ? 1 : undefined}
        strokeDashoffset={ringP < 1 ? 1 - ringP : undefined}
        transform={`rotate(-90 ${RING.cx} ${RING.cy})`}
      />

      {/* shadow strips each band casts on the ring's right side */}
      <g clipPath={`url(#${uid}ring)`}>
        {BANDS.map((b, i) => (
          <g key={i} clipPath={`url(#${uid}s${i})`}>
            <path d={b.shaft} transform={`translate(0 ${SHADOW_DY})`} fill="#000" fillOpacity={0.2} />
          </g>
        ))}
      </g>

      {BANDS.map((b, i) => (
        <g key={i} fill={b.color}>
          <path d={b.shaft} clipPath={`url(#${uid}s${i})`} />
          {heads[i] > 0 && (
            <path
              d={b.head}
              opacity={Math.min(1, heads[i] * 1.6)}
              transform={
                heads[i] < 1
                  ? `translate(${b.neck[0]} ${b.neck[1]}) scale(${heads[i]}) translate(${-b.neck[0]} ${-b.neck[1]})`
                  : undefined
              }
            />
          )}
        </g>
      ))}
    </svg>
  );
}
