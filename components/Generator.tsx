"use client";

// Generator — conversational form + honest sequenced loading copy.
// Submitting fires the real generation pipeline (/api/generate). The status
// lines animate while the request runs (30–60s); navigation happens when the
// pipeline returns, not on a fake timer.

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

const LOADING_LINES = [
  "Finding interesting places nearby…",
  "Reading what Wikipedia knows about them…",
  "Writing your tour…",
  "Plotting the route.",
];

function Sparkline({ accent }: { accent: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" style={{ display: "inline-block" }}>
      <circle cx="7" cy="7" r="2" fill={accent}>
        <animate attributeName="r" values="2;3.5;2" dur="1.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.4;1" dur="1.4s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

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

  // Advance the status copy on a timer, then hold on the last line until the
  // pipeline resolves and we navigate away.
  React.useEffect(() => {
    if (stage !== "loading") return;
    if (step >= LOADING_LINES.length - 1) return;
    const timings = [1500, 1800, 2200, 1600];
    const t = setTimeout(
      () => setStep((s) => s + 1),
      timings[Math.min(step, timings.length - 1)]
    );
    return () => clearTimeout(t);
  }, [stage, step]);

  if (stage === "error") {
    return (
      <div className="screen generator">
        <button className="gen-cancel" onClick={() => setStage("form")}>
          ← back
        </button>
        <div className="gen-wrap">
          <div
            className="gen-sentence"
            style={{ color: "var(--ink-mid)", maxWidth: "30ch" }}
          >
            {error}
          </div>
          <div className="gen-action">
            <button className="gen-submit" onClick={submit}>
              Try again <span className="arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === "loading") {
    return (
      <div className="screen generator generator-loading">
        <button className="gen-cancel" onClick={() => router.push("/")}>
          ← back
        </button>
        <div className="loading-wrap">
          <div className="loading-stack">
            {LOADING_LINES.map((line, i) => {
              const state = i < step ? "done" : i === step ? "active" : "pending";
              return (
                <div key={i} className={`loading-line ${state}`}>
                  <span className="loading-glyph">
                    {state === "done" ? "·" : state === "active" ? <Sparkline accent={accent} /> : ""}
                  </span>
                  <span className="loading-text">{line}</span>
                </div>
              );
            })}
          </div>
          <div className="loading-meta">
            <span>{location.trim()}</span>
            <span className="rule-short" />
            <span>{duration} min</span>
            <span className="rule-short" />
            <span>{tags.join(", ") || "—"}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen generator">
      <button className="gen-cancel" onClick={() => router.push("/")}>
        ← back
      </button>
      <div className="gen-wrap">
        <div className="gen-sentence">
          <span className="gen-word">Walk around</span>
          <span className="gen-input-wrap">
            <input
              className="gen-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="a neighborhood"
              size={Math.max(location.length || 14, 14)}
            />
            <span className="gen-underline" />
          </span>

          <span className="gen-word">for</span>

          <span className="gen-segmented">
            {[30, 60, 90, 120].map((m) => (
              <button
                key={m}
                className={`gen-seg ${duration === m ? "on" : ""}`}
                onClick={() => setDuration(m)}
              >
                {m}
                <span className="gen-seg-unit">min</span>
              </button>
            ))}
          </span>

          <span className="gen-word">,</span>
          <span className="gen-word">looking for</span>

          <span className="gen-pills">
            {ALL_TAGS.map((t) => (
              <button
                key={t}
                className={`gen-pill ${tags.includes(t) ? "on" : ""}`}
                onClick={() => toggleTag(t)}
                disabled={!tags.includes(t) && tags.length >= 3}
              >
                {t}
              </button>
            ))}
          </span>

          <span className="gen-period">.</span>
        </div>

        <div className="gen-action">
          <button
            className="gen-submit"
            onClick={submit}
            disabled={!location.trim() || tags.length === 0}
          >
            Make my walk <span className="arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  );
}
