"use client";

// AudioBar — vintage transistor-radio readout, restrained.
// Audio bar density is locked to "tuner" (the tweak the user landed on).

import React from "react";
import type { Stop } from "@/lib/types";

interface Props {
  playing: boolean;
  onToggle: () => void;
  current: Stop | undefined;
  globalSec: number;
  totalSec: number;
  fmtTime: (sec: number) => string;
  accent: string;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (p: number) => void;
}

export function AudioBar({
  playing,
  onToggle,
  current,
  globalSec,
  totalSec,
  fmtTime,
  accent,
  onPrev,
  onNext,
  onSeek,
}: Props) {
  const scrubRef = React.useRef<HTMLDivElement>(null);
  const onScrub = (e: React.MouseEvent) => {
    if (!scrubRef.current) return;
    const rect = scrubRef.current.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(p);
  };

  const ticks = Array.from({ length: 41 }, (_, i) => i);
  // globalSec can momentarily overshoot totalSec on the final stop (progress
  // reaches 1 before playback stops) — clamp so the needle never escapes.
  const pct =
    totalSec > 0 ? Math.max(0, Math.min(100, (globalSec / totalSec) * 100)) : 0;

  return (
    <div className="audiobar audiobar-tuner">
      <div className="audiobar-inner">
        <div className="audiobar-l">
          <button className="audio-btn" onClick={onPrev} aria-label="Previous stop">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <polygon points="2,7 12,2 12,12" transform="rotate(180 7 7)" fill="currentColor" />
            </svg>
          </button>
          <button
            className="audio-play"
            onClick={onToggle}
            aria-label={playing ? "Pause" : "Play"}
            style={{ borderColor: accent, color: accent }}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14">
                <rect x="3" y="2" width="3" height="10" fill="currentColor" />
                <rect x="8" y="2" width="3" height="10" fill="currentColor" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14">
                <polygon points="3,2 12,7 3,12" fill="currentColor" />
              </svg>
            )}
          </button>
          <button className="audio-btn" onClick={onNext} aria-label="Next stop">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <polygon points="2,2 12,7 2,12" fill="currentColor" />
            </svg>
          </button>
        </div>

        <div className="audiobar-c">
          <div className="readout">
            <span className="readout-band">
              <span className="readout-no">№{current ? String(current.n).padStart(2, "0") : "—"}</span>
              <span className="readout-name">{current ? current.name : "—"}</span>
            </span>
            <span className="readout-meta">
              <span className="readout-time">{fmtTime(globalSec)}</span>
              <span className="readout-sep">/</span>
              <span className="readout-total">{fmtTime(totalSec)}</span>
            </span>
          </div>
          <div className="scrub" ref={scrubRef} onClick={onScrub}>
            <div className="scrub-ticks">
              {ticks.map((t) => (
                <span key={t} className={`tick ${t % 5 === 0 ? "tick-major" : ""}`} />
              ))}
            </div>
            <div className="scrub-track">
              <div className="scrub-fill" style={{ width: `${pct}%`, background: accent }} />
              <div className="scrub-needle" style={{ left: `${pct}%`, background: accent }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
