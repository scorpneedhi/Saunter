// A tiny abstract "postcard art" — a layered SVG that suggests skyline/lake/road
// in the postcard's tone. No literal illustration.

type Tone = "ochre" | "terra" | "ink" | "rose" | "sage" | "brick" | "stone";

const PALETTES: Record<Tone, { bg: string; fg: string; mid: string; line: string }> = {
  ochre: { bg: "#d9b97a", fg: "#5a3a1a", mid: "#b88a4a", line: "#3a2208" },
  terra: { bg: "#c87a55", fg: "#3a1a0e", mid: "#a35d3c", line: "#2a0e08" },
  ink: { bg: "#3e4a4f", fg: "#e9e2d2", mid: "#586a70", line: "#1c2326" },
  rose: { bg: "#d49a8c", fg: "#5a2024", mid: "#b07064", line: "#3a1216" },
  sage: { bg: "#9faa86", fg: "#2c3a26", mid: "#7a8866", line: "#1a2415" },
  brick: { bg: "#a64432", fg: "#2a0c08", mid: "#7d2e1f", line: "#1a0604" },
  stone: { bg: "#c2bca8", fg: "#2c2b22", mid: "#8e8a76", line: "#1a1a14" },
};

export function Postcard({ tone }: { tone: Tone }) {
  const p = PALETTES[tone] || PALETTES.sage;
  return (
    <svg
      viewBox="0 0 200 280"
      preserveAspectRatio="xMidYMid slice"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <defs>
        <pattern id={`pc-${tone}`} width="3" height="3" patternUnits="userSpaceOnUse">
          <rect width="3" height="3" fill={p.bg} />
          <circle cx="1.5" cy="1.5" r="0.3" fill={p.line} opacity="0.18" />
        </pattern>
      </defs>
      <rect width="200" height="280" fill={`url(#pc-${tone})`} />
      {/* Sun / moon */}
      <circle cx="148" cy="68" r="28" fill={p.mid} opacity="0.85" />
      {/* Skyline / horizon line */}
      <path
        d="M 0 180 L 30 180 L 36 156 L 60 156 L 66 168 L 92 168 L 96 142 L 120 142 L 124 156 L 152 156 L 158 134 L 180 134 L 184 160 L 200 160 L 200 280 L 0 280 Z"
        fill={p.fg}
        opacity="0.92"
      />
      {/* Foreground path / road */}
      <path d="M 0 260 Q 100 220, 200 252" fill="none" stroke={p.line} strokeWidth="1.6" opacity="0.7" />
      <path
        d="M 0 250 Q 100 210, 200 244"
        fill="none"
        stroke={p.line}
        strokeWidth="1.6"
        opacity="0.45"
        strokeDasharray="2 4"
      />
      {/* Edge wear */}
      <rect
        x="0"
        y="0"
        width="200"
        height="280"
        fill="none"
        stroke={p.line}
        strokeWidth="0.6"
        opacity="0.35"
        strokeDasharray="1 2"
      />
    </svg>
  );
}
