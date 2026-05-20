"use client";

// Generator — labeled fields (Where / How long / What you're after) + a single
// status line during generation. Audio-walk minimal: no conversational sentence,
// no editorial ornament, no 4-step status ladder.

import React from "react";
import { useRouter } from "next/navigation";

const ALL_TAGS = [
  "history",
  "architecture",
  "public art",
  "hidden gems",
  "food and drink",
  "nature",
];

// Cycle through these status lines while the pipeline runs. The bar holds on
// the last line until the request resolves.
const LOADING_LINES = [
  "Looking around the neighborhood",
  "Reading up on what's there",
  "Routing a walking loop",
  "Writing the tour",
];

export function Generator({ accent }: { accent: string }) {
  const router = useRouter();
  const [location, setLocation] = React.useState("Echo Park, Los Angeles");
  const [duration, setDuration] = React.useState(90);
  const [tags, setTags] = React.useState<string[]>(["architecture", "public art"]);
  const [stage, setStage] = React.useState<"form" | "loading" | "error">("form");
  const [step, setStep] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);

  const toggleTag = (t: string) => {
    setTags((prev) => {
      if (prev.includes(t)) return prev.filter((x) => x !== t);
      if (prev.length >= 3) return prev;
      return [...prev, t];
    });
  };

  const submit = async () => {
    if (!location.trim() || tags.length === 0) return;
    setStage("loading");
    setStep(0);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: location.trim(), duration, tags }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't build your walk.");
      router.push(`/${data.citySlug}/${data.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build your walk.");
      setStage("error");
    }
  };

  // Cycle status copy; hold on the last line until the pipeline resolves.
  React.useEffect(() => {
    if (stage !== "loading") return;
    if (step >= LOADING_LINES.length - 1) return;
    const timings = [1400, 1500, 1700, 1500];
    const t = setTimeout(
      () => setStep((s) => s + 1),
      timings[Math.min(step, timings.length - 1)]
    );
    return () => clearTimeout(t);
  }, [stage, step]);

  if (stage === "error") {
    return (
      <div className="screen generator">
        <div className="gen-top">
          <button className="gen-back" onClick={() => setStage("form")}>back</button>
          <span className="gen-step">Something went wrong</span>
        </div>
        <h2 className="gen-prompt" style={{ color: "var(--fg-2)" }}>{error}</h2>
        <div className="gen-submit-row">
          <button className="btn btn-accent" onClick={submit}>
            Try again
            <span className="btn-arrow">→</span>
          </button>
        </div>
      </div>
    );
  }

  if (stage === "loading") {
    const liveLine = LOADING_LINES[Math.min(step, LOADING_LINES.length - 1)];
    const progress = Math.min(1, (step + 1) / (LOADING_LINES.length + 1));
    return (
      <div className="screen gen-loading">
        <div className="gen-top">
          <button className="gen-back" onClick={() => router.push("/")}>back</button>
          <span className="gen-step">Drafting walk</span>
        </div>

        <div className="loading-canvas">
          <LoadingMap progress={progress} accent={accent} />
        </div>

        <div className="loading-status">
          <span className="pulse" aria-hidden="true" />
          <span>{liveLine}…</span>
        </div>
        <div className="loading-meta">
          <span><strong>{location.trim()}</strong></span>
          <span>
            {duration} minutes · {tags.join(", ") || "—"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="screen generator">
      <div className="gen-top">
        <button className="gen-back" onClick={() => router.push("/")}>back</button>
        <span className="gen-step">New walk</span>
      </div>

      <h2 className="gen-prompt">
        Let&apos;s <span className="em">make a walk.</span>
      </h2>

      <div className="gen-fields">
        <div className="field">
          <label className="field-label">Where</label>
          <input
            className="text-input"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="A neighborhood or address"
          />
        </div>

        <div className="field">
          <label className="field-label">
            How long <span className="hint">— minutes on foot</span>
          </label>
          <div className="segmented">
            {[30, 60, 90, 120].map((m) => (
              <button
                key={m}
                className={`seg ${duration === m ? "on" : ""}`}
                onClick={() => setDuration(m)}
              >
                {m}
                <span className="unit">min</span>
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="field-label">
            What you&apos;re after <span className="hint">— pick up to 3</span>
          </label>
          <div className="chips">
            {ALL_TAGS.map((t) => (
              <button
                key={t}
                className={`chip ${tags.includes(t) ? "on" : ""}`}
                onClick={() => toggleTag(t)}
                disabled={!tags.includes(t) && tags.length >= 3}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="gen-submit-row">
        <button
          className="btn btn-accent"
          onClick={submit}
          disabled={!location.trim() || tags.length === 0}
        >
          Make my walk
          <span className="btn-arrow">→</span>
        </button>
      </div>
    </div>
  );
}

// Tiny abstract map that draws itself while loading. Uses ECHO_PARK_ROUTE-ish
// straight diagonals — we don't have a real route yet at this stage.
function LoadingMap({ progress, accent }: { progress: number; accent: string }) {
  const W = 340;
  const H = 320;
  // Synthesize a squiggle so the canvas is never blank
  const pts: [number, number][] = [];
  const N = 20;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const x = 0.10 + t * 0.80;
    const y = 0.80 - t * 0.65 + Math.sin(t * 6) * 0.04;
    pts.push([x * W, y * H]);
  }

  let d = "";
  if (pts.length) {
    d = `M ${pts[0][0]} ${pts[0][1]}`;
    const cut = Math.max(1, Math.floor(pts.length * progress));
    for (let i = 1; i < cut; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
  }

  const grid: React.ReactElement[] = [];
  for (let i = 1; i < 6; i++) {
    grid.push(<line key={`h${i}`} x1="0" y1={(H / 6) * i} x2={W} y2={(H / 6) * i} />);
    grid.push(<line key={`v${i}`} x1={(W / 6) * i} y1="0" x2={(W / 6) * i} y2={H} />);
  }
  const head = pts[Math.min(pts.length - 1, Math.floor(pts.length * progress))];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      <rect width={W} height={H} fill="var(--map-bg)" />
      <g stroke="var(--map-road-fg)" strokeWidth="6" strokeLinecap="round" opacity="0.9">{grid}</g>
      <g stroke="var(--map-road)" strokeWidth="3" strokeLinecap="round">{grid}</g>
      {d && (
        <path
          d={d}
          fill="none"
          stroke={accent}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {head && (
        <circle cx={head[0]} cy={head[1]} r="8" fill={accent} />
      )}
    </svg>
  );
}
