"use client";

// PaperMap — hand-styled SVG paper map for the Echo Park tour.
// Coord space: 0..1 normalized on both axes (matches lib/data.ts).
// Renders into a 1000x1000 viewBox; SVG scales to container.
//
// The design medium settled on this illustrated SVG rather than MapLibre
// because it carries the field-guide / zine feel the brief asked for.
// MapLibre with a custom paper style remains the production target (PRD §8.1).

import React from "react";
import type { Stop, RoutePoint } from "@/lib/types";

interface Props {
  stops: Stop[];
  route: RoutePoint[];
  routeLngLat?: [number, number][]; // unused here; accepted for MapComponent parity
  activeStop: number;
  onStopClick?: (n: number) => void;
  accent: string;
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
  compact = false,
  withCompass = true,
  areas,
  label = "Echo Park",
  subLabel = "34.0782° N · 118.2606° W",
}: Props) {
  const W = 1000;
  const H = 1000;
  const px = (x: number) => x * W;
  const py = (y: number) => y * H;

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

  // Procedural-feeling building blocks. Seeded so they are deterministic
  // (stable between server and client render — no hydration mismatch).
  const buildings = React.useMemo(() => {
    let seed = 1337;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return (seed % 100000) / 100000;
    };
    const out: { x: number; y: number; w: number; h: number; rot: number }[] = [];
    for (let i = 0; i < 220; i++) {
      const x = rand();
      const y = rand();
      if (x > 0.58 && y < 0.28) continue; // lake
      if (x < 0.15 && y > 0.78) continue; // park edge
      if (x > 0.82 && y > 0.78) continue; // park edge
      const w = 0.018 + rand() * 0.05;
      const h = 0.014 + rand() * 0.04;
      const rot = (rand() - 0.5) * 6;
      const gx = Math.round(x * 12) / 12;
      const gy = Math.round(y * 12) / 12;
      out.push({ x: gx + (rand() - 0.5) * 0.01, y: gy + (rand() - 0.5) * 0.01, w, h, rot });
    }
    return out;
  }, []);

  // Roads: a sparse grid; deterministic jitter for a hand-drawn feel.
  const roads = React.useMemo(() => {
    const j = (i: number) => (((i * 2654435761) % 1000) / 1000 - 0.5) * 0.01;
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    [0.18, 0.35, 0.52, 0.68, 0.84].forEach((y, i) => {
      lines.push({ x1: 0.02, y1: y + j(i), x2: 0.98, y2: y - j(i + 7) });
    });
    lines.push({ x1: 0.0, y1: 0.62, x2: 1.0, y2: 0.46 });
    lines.push({ x1: 0.0, y1: 0.3, x2: 1.0, y2: 0.18 });
    [0.16, 0.3, 0.46, 0.6, 0.76, 0.9].forEach((x) => {
      lines.push({ x1: x, y1: 0.02, x2: x, y2: 0.98 });
    });
    return lines;
  }, []);

  const stopFill = accent;

  return (
    <div className="papermap-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="papermap-svg">
        <defs>
          <filter id="papergrain" x="0" y="0" width="100%" height="100%">
            <feTurbulence baseFrequency="0.9" numOctaves="2" seed="3" />
            <feColorMatrix
              values="0 0 0 0 0.15
                      0 0 0 0 0.12
                      0 0 0 0 0.10
                      0 0 0 0.06 0"
            />
          </filter>
          <filter id="markerShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" />
            <feOffset dx="0" dy="1.5" result="offblur" />
            <feComponentTransfer result="shadow">
              <feFuncA type="linear" slope="0.45" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="rough" x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="2" seed="7" />
            <feDisplacementMap in="SourceGraphic" scale="3.5" />
          </filter>
          <pattern id="parkHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(82,98,76,0.18)" strokeWidth="0.7" />
          </pattern>
          <pattern id="waterRipple" patternUnits="userSpaceOnUse" width="22" height="14">
            <path d="M0 7 Q 5.5 3, 11 7 T 22 7" fill="none" stroke="rgba(112,138,150,0.28)" strokeWidth="0.6" />
          </pattern>
        </defs>

        {/* Paper background */}
        <rect width={W} height={H} fill="var(--paper)" />
        <rect width={W} height={H} fill="url(#papergrain)" opacity="0.55" />

        {/* Faint contour lines */}
        <g stroke="rgba(112,98,72,0.10)" strokeWidth="0.6" fill="none">
          <path d={`M ${px(0)} ${py(0.92)} Q ${px(0.3)} ${py(0.86)} ${px(0.55)} ${py(0.88)} T ${px(1)} ${py(0.84)}`} />
          <path d={`M ${px(0)} ${py(0.86)} Q ${px(0.3)} ${py(0.8)} ${px(0.55)} ${py(0.82)} T ${px(1)} ${py(0.78)}`} />
          <path d={`M ${px(0)} ${py(0.8)} Q ${px(0.3)} ${py(0.74)} ${px(0.55)} ${py(0.76)} T ${px(1)} ${py(0.72)}`} />
        </g>

        {/* Parks & water. Generated tours pass real OSM polygons; the static
            mock has none, so it falls back to the decorative Echo Park shapes. */}
        {areas && areas.length > 0 ? (
          <g>
            {areas.map((a, i) => {
              const d =
                a.points
                  .map((pt, j) => `${j ? "L" : "M"} ${px(pt[0])} ${py(pt[1])}`)
                  .join(" ") + " Z";
              if (a.kind === "water") {
                return (
                  <g key={i}>
                    <path d={d} fill="rgba(180,200,210,0.55)" stroke="rgba(112,138,150,0.55)" strokeWidth="0.8" />
                    <path d={d} fill="url(#waterRipple)" />
                  </g>
                );
              }
              return (
                <g key={i}>
                  <path d={d} fill="rgba(167,182,140,0.55)" />
                  <path d={d} fill="url(#parkHatch)" />
                </g>
              );
            })}
          </g>
        ) : (
          <>
            <g>
              <path d={`M ${px(0.62)} ${py(0.04)} L ${px(0.96)} ${py(0.02)} L ${px(0.99)} ${py(0.3)} L ${px(0.6)} ${py(0.28)} Z`} fill="rgba(167,182,140,0.55)" />
              <path d={`M ${px(0.62)} ${py(0.04)} L ${px(0.96)} ${py(0.02)} L ${px(0.99)} ${py(0.3)} L ${px(0.6)} ${py(0.28)} Z`} fill="url(#parkHatch)" />

              <path d={`M ${px(0.02)} ${py(0.86)} L ${px(0.2)} ${py(0.84)} L ${px(0.22)} ${py(0.98)} L ${px(0.02)} ${py(0.99)} Z`} fill="rgba(167,182,140,0.55)" />
              <path d={`M ${px(0.02)} ${py(0.86)} L ${px(0.2)} ${py(0.84)} L ${px(0.22)} ${py(0.98)} L ${px(0.02)} ${py(0.99)} Z`} fill="url(#parkHatch)" />

              <path d={`M ${px(0.8)} ${py(0.84)} L ${px(0.99)} ${py(0.86)} L ${px(0.99)} ${py(0.99)} L ${px(0.82)} ${py(0.99)} Z`} fill="rgba(167,182,140,0.55)" />
              <path d={`M ${px(0.8)} ${py(0.84)} L ${px(0.99)} ${py(0.86)} L ${px(0.99)} ${py(0.99)} L ${px(0.82)} ${py(0.99)} Z`} fill="url(#parkHatch)" />
            </g>

            <g>
              <path
                d={`M ${px(0.66)} ${py(0.1)}
                    C ${px(0.7)} ${py(0.05)}, ${px(0.84)} ${py(0.06)}, ${px(0.88)} ${py(0.12)}
                    C ${px(0.92)} ${py(0.18)}, ${px(0.86)} ${py(0.24)}, ${px(0.76)} ${py(0.24)}
                    C ${px(0.66)} ${py(0.24)}, ${px(0.62)} ${py(0.16)}, ${px(0.66)} ${py(0.1)} Z`}
                fill="rgba(180,200,210,0.55)"
                stroke="rgba(112,138,150,0.55)"
                strokeWidth="0.8"
              />
              <path
                d={`M ${px(0.66)} ${py(0.1)}
                    C ${px(0.7)} ${py(0.05)}, ${px(0.84)} ${py(0.06)}, ${px(0.88)} ${py(0.12)}
                    C ${px(0.92)} ${py(0.18)}, ${px(0.86)} ${py(0.24)}, ${px(0.76)} ${py(0.24)}
                    C ${px(0.66)} ${py(0.24)}, ${px(0.62)} ${py(0.16)}, ${px(0.66)} ${py(0.1)} Z`}
                fill="url(#waterRipple)"
              />
            </g>
          </>
        )}

        {/* Roads — warm tan */}
        <g stroke="rgba(196,176,140,0.55)" strokeWidth="6" strokeLinecap="round">
          {roads.map((r, i) => (
            <line key={i} x1={px(r.x1)} y1={py(r.y1)} x2={px(r.x2)} y2={py(r.y2)} />
          ))}
        </g>
        <g stroke="var(--paper)" strokeWidth="2" strokeLinecap="round" opacity="0.7">
          {roads.map((r, i) => (
            <line key={i} x1={px(r.x1)} y1={py(r.y1)} x2={px(r.x2)} y2={py(r.y2)} />
          ))}
        </g>

        {/* Buildings — warm grey blocks */}
        <g>
          {buildings.map((b, i) => (
            <rect
              key={i}
              x={px(b.x - b.w / 2)}
              y={py(b.y - b.h / 2)}
              width={px(b.w)}
              height={py(b.h)}
              transform={`rotate(${b.rot} ${px(b.x)} ${py(b.y)})`}
              fill="rgba(122,108,86,0.18)"
              stroke="rgba(82,72,56,0.25)"
              strokeWidth="0.5"
            />
          ))}
        </g>

        {/* Route line — accent, slightly roughened */}
        <g filter="url(#rough)">
          <path d={routePath} fill="none" stroke={accent} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
          <path d={routePath} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.1 8" opacity="0.55" />
        </g>

        {/* Stop markers */}
        <g>
          {stops.map((s) => {
            const active = activeStop === s.n;
            const r = active ? 24 : 20;
            return (
              <g
                key={s.n}
                transform={`translate(${px(s.coord.x)} ${py(s.coord.y)})`}
                style={{ cursor: "pointer", transition: "transform 240ms ease" }}
                onClick={() => onStopClick && onStopClick(s.n)}
              >
                <circle r={r + 4} fill="var(--paper)" opacity="0.8" filter="url(#markerShadow)" />
                <circle r={r} fill={stopFill} stroke="var(--paper)" strokeWidth="2.5" />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="var(--serif)"
                  fontWeight="500"
                  fontSize={r * 1.05}
                  fill="var(--paper)"
                  style={{ fontFeatureSettings: '"lnum" 1' }}
                >
                  {s.n}
                </text>
              </g>
            );
          })}
        </g>

        {/* "You are here" current dot — pulses on active */}
        {activeStop &&
          (() => {
            const s = stops.find((x) => x.n === activeStop);
            if (!s) return null;
            return (
              <g transform={`translate(${px(s.coord.x)} ${py(s.coord.y)})`} pointerEvents="none">
                <circle r="38" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.5">
                  <animate attributeName="r" from="30" to="60" dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.55" to="0" dur="2s" repeatCount="indefinite" />
                </circle>
              </g>
            );
          })()}

        {/* Compass rose */}
        {withCompass && (
          <g transform={`translate(${W - 90}, ${H - 90})`}>
            <circle r="46" fill="rgba(244,237,224,0.88)" stroke="rgba(82,72,56,0.35)" strokeWidth="0.8" />
            <g stroke="rgba(60,50,38,0.85)" strokeWidth="0.8" fill="rgba(60,50,38,0.85)">
              <polygon points="0,-32 5,0 0,4 -5,0" />
              <polygon points="0,32 5,0 0,-4 -5,0" fill="rgba(60,50,38,0.35)" />
              <polygon points="32,0 0,5 -4,0 0,-5" fill="rgba(60,50,38,0.35)" />
              <polygon points="-32,0 0,5 4,0 0,-5" fill="rgba(60,50,38,0.35)" />
            </g>
            <text textAnchor="middle" y="-36" fontFamily="var(--serif)" fontSize="11" fill="rgba(60,50,38,0.85)" fontStyle="italic">N</text>
            <text textAnchor="middle" y="42" fontFamily="var(--serif)" fontSize="10" fill="rgba(60,50,38,0.55)" fontStyle="italic">S</text>
            <text textAnchor="middle" x="40" y="3" fontFamily="var(--serif)" fontSize="10" fill="rgba(60,50,38,0.55)" fontStyle="italic">E</text>
            <text textAnchor="middle" x="-40" y="3" fontFamily="var(--serif)" fontSize="10" fill="rgba(60,50,38,0.55)" fontStyle="italic">W</text>
          </g>
        )}

        {/* Scale bar */}
        {!compact && (
          <g transform={`translate(40, ${H - 60})`}>
            <line x1="0" y1="0" x2="120" y2="0" stroke="rgba(60,50,38,0.6)" strokeWidth="1.2" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="rgba(60,50,38,0.6)" strokeWidth="1.2" />
            <line x1="60" y1="-3" x2="60" y2="3" stroke="rgba(60,50,38,0.6)" strokeWidth="1.2" />
            <line x1="120" y1="-4" x2="120" y2="4" stroke="rgba(60,50,38,0.6)" strokeWidth="1.2" />
            <text x="0" y="20" fontFamily="var(--mono)" fontSize="11" fill="rgba(60,50,38,0.7)">0</text>
            <text x="120" y="20" fontFamily="var(--mono)" fontSize="11" fill="rgba(60,50,38,0.7)" textAnchor="end">¼ mi</text>
          </g>
        )}

        {/* Map plate label */}
        {!compact && (
          <g transform={`translate(40, 56)`}>
            <text fontFamily="var(--serif)" fontStyle="italic" fontSize="22" fill="rgba(60,50,38,0.85)">{label}</text>
            <text y="20" fontFamily="var(--mono)" fontSize="10" letterSpacing="0.12em" fill="rgba(60,50,38,0.55)">{subLabel}</text>
          </g>
        )}
      </svg>
    </div>
  );
}
