"use client";

// Tour page — the heart of the product.
// Map fills the top on mobile (sticky), the stop list scrolls below,
// a fixed transistor-radio audio bar sits at the bottom.
// Drop cap on intro is locked on (the tweak the user landed on).

import React from "react";
import { useRouter } from "next/navigation";
import { PaperMap } from "./PaperMap";
import { StopPhoto } from "./StopPhoto";
import { AudioBar } from "./AudioBar";
import type { Tour as TourType, RoutePoint } from "@/lib/types";

const ACCENT = "#2e4a32"; // deep forest
const STOP_AUDIO_SEC = 38;

export function Tour({ tour, route }: { tour: TourType; route: RoutePoint[] }) {
  const router = useRouter();
  const routePts = tour.route ?? route;
  const mapSubLabel = tour.center
    ? `${Math.abs(tour.center.lat).toFixed(4)}° ${tour.center.lat >= 0 ? "N" : "S"} · ${Math.abs(
        tour.center.lng
      ).toFixed(4)}° ${tour.center.lng >= 0 ? "E" : "W"}`
    : "34.0782° N · 118.2606° W";
  const [activeStop, setActiveStop] = React.useState(1);
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [shareToast, setShareToast] = React.useState(false);
  const stopRefs = React.useRef<Record<number, HTMLElement | null>>({});
  const listRef = React.useRef<HTMLDivElement>(null);
  const userScrolling = React.useRef(false);

  // Simulate audio playback: each stop is ~38 seconds.
  React.useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const startProg = progress;
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      const p = startProg + elapsed / STOP_AUDIO_SEC;
      if (p >= 1) {
        setProgress(0);
        if (activeStop < tour.stops.length) {
          setActiveStop((s) => s + 1);
        } else {
          setPlaying(false);
        }
        return;
      }
      setProgress(p);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, activeStop]);

  // When the active stop changes, scroll its card into view.
  React.useEffect(() => {
    const el = stopRefs.current[activeStop];
    if (!el || !listRef.current) return;
    if (userScrolling.current) return;
    const listRect = listRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetTop = listRef.current.scrollTop + (elRect.top - listRect.top) - 96;
    listRef.current.scrollTo({ top: targetTop, behavior: "smooth" });
  }, [activeStop]);

  const handleStopClick = (n: number) => {
    setActiveStop(n);
    setProgress(0);
  };

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  };

  const current = tour.stops.find((s) => s.n === activeStop);
  const totalSec = tour.stops.length * STOP_AUDIO_SEC;
  const globalSec =
    tour.stops.findIndex((s) => s.n === activeStop) * STOP_AUDIO_SEC +
    progress * STOP_AUDIO_SEC;
  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="screen tour">
      <header className="tour-mast">
        <button className="tour-back" onClick={() => router.push("/")}>
          <span aria-hidden="true">←</span> Saunter
        </button>
        <div className="tour-mast-center"></div>
        <div className="tour-mast-r">
          <button className="tour-share" onClick={handleShare}>
            Share this walk
          </button>
          {shareToast && (
            <span className="tour-toast">Link copied · saunter.app/echo-park/…</span>
          )}
        </div>
      </header>

      <div className="tour-body">
        {/* LEFT: stop list */}
        <div className="tour-list" ref={listRef}>
          <div className="tour-intro">
            <p className="overline">
              <span>A {tour.duration}-minute walk through</span>
            </p>
            <h1 className="tour-title">
              <em>{tour.city}</em>
            </h1>
            <p className="tour-sub">
              {tour.region} · {tour.tags.join(" + ")}
            </p>

            <div className="tour-meta-strip">
              <span>
                <span className="meta-num">{tour.distanceMi}</span> mi ·{" "}
                <span className="meta-num">{tour.distanceKm}</span> km
              </span>
              <span className="rule-short" />
              <span>
                ~<span className="meta-num">{tour.duration}</span> min on foot
              </span>
              <span className="rule-short" />
              <span>
                <span className="meta-num">{tour.stops_count}</span> stops
              </span>
            </div>

            <p className="tour-blurb">
              <span className="dropcap">{tour.intro[0]}</span>
              {tour.intro.slice(1)}
            </p>
          </div>

          <div className="tour-stops">
            {tour.stops.map((s) => (
              <article
                key={s.n}
                ref={(el) => {
                  stopRefs.current[s.n] = el;
                }}
                className={`stop ${activeStop === s.n ? "active" : ""}`}
                onClick={() => handleStopClick(s.n)}
              >
                <div className="stop-num">
                  <span className="stop-num-glyph">{s.n}</span>
                  <span className="stop-num-line" />
                  <span className="stop-num-walk">
                    +{s.walkMin}
                    <small>min</small>
                  </span>
                </div>

                <div className="stop-body">
                  <p className="stop-type">{s.type}</p>
                  <h2 className="stop-name">{s.name}</h2>
                  <div className="stop-photo-row">
                    <StopPhoto tone={s.photoTone} n={s.n} />
                  </div>
                  <p className="stop-blurb">{s.blurb}</p>
                </div>
              </article>
            ))}

            <div className="tour-outro">
              <div className="ornament">
                <span className="orn-rule" />
                <span className="orn-glyph">✦</span>
                <span className="orn-rule" />
              </div>
              <p className="tour-outro-body">{tour.outro}</p>
            </div>
          </div>
        </div>

        {/* RIGHT: sticky map */}
        <div className="tour-map">
          <div className="tour-map-inner">
            <PaperMap
              stops={tour.stops}
              route={routePts}
              activeStop={activeStop}
              onStopClick={handleStopClick}
              accent={ACCENT}
              areas={tour.areas}
              label={tour.city}
              subLabel={mapSubLabel}
            />
            <div className="map-overlay-br">
              <p className="overline ink">
                Stop {String(activeStop).padStart(2, "0")} /{" "}
                {String(tour.stops.length).padStart(2, "0")}
              </p>
              <p className="map-overlay-now">{current && current.name}</p>
            </div>
          </div>
        </div>
      </div>

      <AudioBar
        playing={playing}
        onToggle={() => setPlaying((p) => !p)}
        current={current}
        globalSec={globalSec}
        totalSec={totalSec}
        fmtTime={fmtTime}
        accent={ACCENT}
        onSeek={(p) => setProgress(p)}
        onPrev={() => {
          setProgress(0);
          setActiveStop((s) => Math.max(1, s - 1));
        }}
        onNext={() => {
          setProgress(0);
          setActiveStop((s) => Math.min(tour.stops.length, s + 1));
        }}
      />
    </div>
  );
}
