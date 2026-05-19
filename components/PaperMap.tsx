"use client";

// PaperMap — clean modern abstract map.
// Streets as crisp white lines, blocks as soft fills, route as a single accent
// stroke, numbered circle pins with a pulse ring on the active stop.
// No paper grain, no italic compass, no contour lines.

import React from "react";
import type { Stop, RoutePoint } from "@/lib/types";

interface Props {
  stops: Stop[];
  route: RoutePoint[];
  routeLngLat?: [number, number][]; // unused here; accepted for MapComponent parity
  activeStop: number;
  onStopClick?: (n: number) => void;
  accent: string;
  // The new design has no compass / plate label / scale bar. These props are
  // kept for API parity with the previous PaperMap (used by Tour + OG image)
  // but they are intentionally not rendered.
  compact?: boolean;
  withCompass?: boolean;
  areas?: { kind: "park" | "water"; points: [number, number][] }[];
  label?: string;
  subLabel?: string;
}

export function PaperMap({
  stops,
  route,
  activeStop,
  onStopClick,
  accent,
  areas,
}: Props) {
  const W = 1000;
  const H = 700;
  const px = (x: number) => x * W;
  const py = (y: number) => y * H;

  // Smoothed route path (Catmull-Rom-ish via quadratic midpoints).
  const routePath = React.useMemo(() => {
    if (!route || route.length === 0) return "";
    const pts = route.map(([x, y]) => [px(x), py(y)]);
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      d += ` Q ${x0} ${y0} ${mx} ${my}`;
    }
    d += ` T ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Roads — clean rectilinear grid + two diagonals.
  const roads = React.useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; thick?: number }[] = [];
    [0.16, 0.30, 0.46, 0.60, 0.74, 0.88].forEach((y) => {
      lines.push({ x1: -0.02, y1: y, x2: 1.02, y2: y - 0.01 });
    });
    [0.12, 0.26, 0.42, 0.58, 0.74, 0.88].forEach((x) => {
      lines.push({ x1: x, y1: -0.02, x2: x + 0.01, y2: 1.02 });
    });
    lines.push({ x1: -0.02, y1: 0.62, x2: 1.02, y2: 0.46, thick: 1.3 });
    lines.push({ x1: -0.02, y1: 0.30, x2: 1.02, y2: 0.20, thick: 1.3 });
    return lines;
  }, []);

  // Deterministic block fills.
  const blocks = React.useMemo(() => {
    let seed = 1337;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed % 100000) / 100000;
    };
    const out: { x: number; y: number; w: number; h: number; variant: "base" | "alt" }[] = [];
    const xs = [0.12, 0.26, 0.42, 0.58, 0.74, 0.88];
    const ys = [0.16, 0.30, 0.46, 0.60, 0.74, 0.88];
    for (let i = 0; i < xs.length - 1; i++) {
      for (let j = 0; j < ys.length - 1; j++) {
        // Skip lake & park areas
        if (xs[i] > 0.58 && ys[j] < 0.20) continue;
        if (xs[i] < 0.20 && ys[j] > 0.78) continue;
        if (rand() < 0.18) continue;
        const padX = 0.008 + rand() * 0.008;
        const padY = 0.008 + rand() * 0.008;
        out.push({
          x: xs[i] + padX,
          y: ys[j] + padY,
          w: xs[i + 1] - xs[i] - padX * 2,
          h: ys[j + 1] - ys[j] - padY * 2,
          variant: rand() > 0.7 ? "alt" : "base",
        });
      }
    }
    return out;
  }, []);

  return (
    <div className="papermap-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="papermap-svg">
        {/* base */}
        <rect width={W} height={H} fill="var(--map-bg)" />

        {/* Parks & water — pipeline-generated tours pass real OSM polygons.
            Without `areas`, we paint a tasteful default Echo-Park-ish backdrop. */}
        {areas && areas.length > 0 ? (
          <g>
            {areas.map((a, i) => {
              const d =
                a.points
                  .map((pt, j) => `${j ? "L" : "M"} ${px(pt[0])} ${py(pt[1])}`)
                  .join(" ") + " Z";
              return (
                <path
                  key={i}
                  d={d}
                  fill={a.kind === "water" ? "var(--map-water)" : "var(--map-park)"}
                />
              );
            })}
          </g>
        ) : (
          <>
            {/* park (top-right) */}
            <path
              d={`M ${px(0.58)} ${py(0.02)} L ${px(1.02)} ${py(-0.02)} L ${px(1.02)} ${py(0.30)} L ${px(0.56)} ${py(0.28)} Z`}
              fill="var(--map-park)"
            />
            {/* park (bottom-left) */}
            <path
              d={`M ${px(-0.02)} ${py(0.78)} L ${px(0.22)} ${py(0.80)} L ${px(0.20)} ${py(1.02)} L ${px(-0.02)} ${py(1.02)} Z`}
              fill="var(--map-park)"
            />
            {/* lake within the top park */}
            <ellipse
              cx={px(0.80)} cy={py(0.14)} rx={px(0.13)} ry={py(0.08)}
              fill="var(--map-water)"
            />
          </>
        )}

        {/* blocks */}
        <g>
          {blocks.map((b, i) => (
            <rect
              key={i}
              x={px(b.x)}
              y={py(b.y)}
              width={px(b.w)}
              height={py(b.h)}
              fill={b.variant === "alt" ? "var(--map-block-ink)" : "var(--map-block)"}
              rx="1"
            />
          ))}
        </g>

        {/* road casings */}
        <g stroke="var(--map-road-fg)" strokeLinecap="round" fill="none">
          {roads.map((r, i) => (
            <line
              key={`c${i}`}
              x1={px(r.x1)} y1={py(r.y1)} x2={px(r.x2)} y2={py(r.y2)}
              strokeWidth={(r.thick || 1) * 14}
            />
          ))}
        </g>
        {/* road fills */}
        <g stroke="var(--map-road)" strokeLinecap="round" fill="none">
          {roads.map((r, i) => (
            <line
              key={`f${i}`}
              x1={px(r.x1)} y1={py(r.y1)} x2={px(r.x2)} y2={py(r.y2)}
              strokeWidth={(r.thick || 1) * 10}
            />
          ))}
        </g>

        {/* route */}
        <path
          d={routePath}
          fill="none"
          stroke={accent}
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* stop pins */}
        <g>
          {stops.map((s) => {
            const active = activeStop === s.n;
            const r = active ? 22 : 16;
            return (
              <g
                key={s.n}
                transform={`translate(${px(s.coord.x)} ${py(s.coord.y)})`}
                className="map-pin"
                onClick={() => onStopClick && onStopClick(s.n)}
              >
                {active && (
                  <circle r={r + 14} fill={accent} opacity="0.15">
                    <animate attributeName="r" from={r + 8} to={r + 22} dur="1.8s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.25" to="0" dur="1.8s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  r={r}
                  fill={active ? accent : "#ffffff"}
                  stroke={active ? "#ffffff" : accent}
                  strokeWidth={2.5}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="map-pin-label"
                  fill={active ? "#ffffff" : accent}
                  fontSize={r * 0.95}
                >
                  {s.n}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
