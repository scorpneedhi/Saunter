"use client";

// AudioBar — clean pinned dock. Prev / play / next + stop name & progress
// readout + thin scrubber with a small needle. Light surface, not dark; no
// tuner ticks, no transistor LED, no № styling.

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
  totalStops?: number;
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
  totalStops,
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

  // globalSec can momentarily overshoot totalSec on the final stop (progress
  // reaches 1 before playback stops) — clamp so the needle never escapes.
  const pct =
    totalSec > 0 ? Math.max(0, Math.min(100, (globalSec / totalSec) * 100)) : 0;

  const n = current ? String(current.n).padStart(2, "0") : "—";
  const name = current ? current.name : "—";

  return (
    <div className="audiodock">
      <div className="audiodock-inner">
        <div className="audiodock-row">
          <button className="audio-step" onClick={onPrev} aria-label="Previous stop">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <polygon points="12,2 12,12 2,7" fill="currentColor" />
            </svg>
          </button>

          <button
            className="audio-play"
            onClick={onToggle}
            aria-label={playing ? "Pause" : "Play"}
            style={{ background: accent }}
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

          <button className="audio-step" onClick={onNext} aria-label="Next stop">
            <svg width="14" height="14" viewBox="0 0 14 14">
              <polygon points="2,2 2,12 12,7" fill="currentColor" />
            </svg>
          </button>

          <div className="audio-now">
            <div className="name">
              {n} · {name}
            </div>
            <div className="meta">
              {fmtTime(globalSec)} / {fmtTime(totalSec)}
              {typeof totalStops === "number"
                ? ` · stop ${current ? current.n : "—"} of ${totalStops}`
                : ""}
            </div>
          </div>
        </div>

        <div className="audio-scrub" ref={scrubRef} onClick={onScrub}>
          <div
            className="audio-scrub-fill"
            style={{ width: `${pct}%`, background: accent }}
          />
          <div
            className="audio-scrub-needle"
            style={{ left: `${pct}%`, background: accent }}
          />
        </div>
      </div>
    </div>
  );
}
