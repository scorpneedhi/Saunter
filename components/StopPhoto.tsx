// Stylized "photo" placeholder for each stop. Conveys vibe without a real image.

import type { PhotoTone } from "@/lib/types";

const PALETTES: Record<PhotoTone, { a: string; b: string; c: string }> = {
  "warm-grey": { a: "#bdb4a3", b: "#5b5247", c: "#867c6c" },
  brick: { a: "#b47660", b: "#5a2a1b", c: "#874a36" },
  sage: { a: "#a1ab85", b: "#3c4a32", c: "#6e7a54" },
  cream: { a: "#dccdb0", b: "#604f34", c: "#a08868" },
};

export function StopPhoto({ tone, n }: { tone: PhotoTone; n: number }) {
  const p = PALETTES[tone] || PALETTES["warm-grey"];
  return (
    <figure className="stop-photo">
      <div className="stop-photo-frame">
        <svg
          viewBox="0 0 320 200"
          preserveAspectRatio="xMidYMid slice"
          style={{ width: "100%", height: "100%", display: "block" }}
        >
          <defs>
            <linearGradient id={`pg-${n}-${tone}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={p.a} />
              <stop offset="1" stopColor={p.c} />
            </linearGradient>
            <pattern id={`pat-${n}-${tone}`} width="3" height="3" patternUnits="userSpaceOnUse">
              <rect width="3" height="3" fill={`url(#pg-${n}-${tone})`} />
              <rect x="0" y="0" width="1" height="1" fill={p.b} opacity="0.10" />
            </pattern>
          </defs>
          <rect width="320" height="200" fill={`url(#pat-${n}-${tone})`} />
          {/* Layered building / horizon silhouettes */}
          <path
            d="M 0 150 L 30 150 L 36 120 L 70 120 L 76 134 L 110 134 L 116 96 L 148 96 L 154 120 L 188 120 L 194 86 L 224 86 L 230 110 L 264 110 L 270 130 L 320 130 L 320 200 L 0 200 Z"
            fill={p.b}
            opacity="0.80"
          />
          <path
            d="M 0 168 L 60 168 L 66 154 L 120 154 L 126 168 L 200 168 L 206 152 L 260 152 L 266 170 L 320 170 L 320 200 L 0 200 Z"
            fill={p.b}
            opacity="0.92"
          />
          {/* Sun / glow */}
          <circle cx="240" cy="60" r="18" fill={p.a} opacity="0.55" />
        </svg>
      </div>
      <figcaption>
        <span className="fig-no">Fig. {String(n).padStart(2, "0")}</span>
      </figcaption>
    </figure>
  );
}
