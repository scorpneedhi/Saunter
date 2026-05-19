"use client";

// Tour page — mobile-first audio-walk minimal.
// Layout: hero map (top) · tour head · intro blurb · stops list (rail + name +
// image-slot + blurb) · outro · pinned audio dock at the bottom.
//
// The narration / speech-synthesis engine is preserved untouched from the
// editorial build — only the JSX layout and styling have changed.

import React from "react";
import { useRouter } from "next/navigation";
import { PaperMap } from "./PaperMap";
import { MapLibreMap } from "./MapLibreMap";
import { StopPhoto } from "./StopPhoto";
import { AudioBar } from "./AudioBar";
import type { Tour as TourType, RoutePoint } from "@/lib/types";

const ACCENT = "#FF5C1A"; // trail-blaze orange

// MapLibre is the production map for tours with real coordinates.
// NEXT_PUBLIC_USE_MAPLIBRE=0 forces the SVG PaperMap — an instant kill-switch
// (env flip + restart, no redeploy). Coordinate-less tours (the static mock)
// always fall back to PaperMap via hasGeo regardless of the flag.
const FORCE_SVG = process.env.NEXT_PUBLIC_USE_MAPLIBRE === "0";

// ── Speech narration engine ───────────────────────────────────────────────
// SpeechSynthesis gives us no audio-duration API, so the time readout below
// is a *synthetic estimate* (word count ÷ WORDS_PER_SEC). Real progress for
// the scrubber is driven off SpeechSynthesisUtterance `onboundary` events;
// the seconds figures only feed the cosmetic mm:ss / total display.
const WORDS_PER_SEC = 2.7;
// Chrome silently kills utterances longer than ~15s, so we never speak a
// whole blurb as one utterance — we split into <~MAX_CHUNK char sentence-ish
// pieces and queue them sequentially.
const MAX_CHUNK = 200;
// If no `onboundary` fires this soon after an utterance starts (Safari and a
// few other engines never emit it) we switch this stop to a wall-clock
// estimate so the bar still moves and stops still auto-advance.
const BOUNDARY_GRACE_MS = 1000;

type Segment = { stopIndex: number; text: string; words: number; estSec: number };

function wordCount(s: string): number {
  const t = s.trim();
  return t ? t.split(/\s+/).length : 0;
}

// Split into sentence-ish chunks: break after ". " / "! " / "? " keeping the
// punctuation, then hard-wrap any remaining over-long piece on whitespace so
// no single utterance exceeds MAX_CHUNK characters.
function chunkText(text: string): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const sentence of sentences) {
    if (sentence.length <= MAX_CHUNK) {
      out.push(sentence);
      continue;
    }
    let buf = "";
    for (const w of sentence.split(/\s+/)) {
      if (buf && (buf + " " + w).length > MAX_CHUNK) {
        out.push(buf);
        buf = w;
      } else {
        buf = buf ? buf + " " + w : w;
      }
    }
    if (buf) out.push(buf);
  }
  return out.length ? out : [text.trim()].filter(Boolean);
}

export function Tour({ tour, route }: { tour: TourType; route: RoutePoint[] }) {
  const router = useRouter();
  const routePts = tour.route ?? route;
  // MapLibre needs real geography; the static/mock tour has no stop lat/lng,
  // so it always falls back to the SVG PaperMap.
  const hasGeo = tour.stops.some(
    (s) => typeof s.lat === "number" && typeof s.lng === "number"
  );
  const MapComponent = !FORCE_SVG && hasGeo ? MapLibreMap : PaperMap;
  const mapSubLabel = tour.center
    ? `${Math.abs(tour.center.lat).toFixed(4)}° ${tour.center.lat >= 0 ? "N" : "S"} · ${Math.abs(
        tour.center.lng
      ).toFixed(4)}° ${tour.center.lng >= 0 ? "E" : "W"}`
    : "34.0782° N · 118.2606° W";
  const [activeStop, setActiveStop0] = React.useState(1);
  const [playing, setPlaying0] = React.useState(false);
  // progress is 0..1 *within the active stop* — same semantics as before, so
  // the scroll-into-view effect and the PaperMap pulse keep working untouched.
  const [progress, setProgress0] = React.useState(0);

  // ── Render-phase-safe state updates for the speech engine ─────────────────
  // The narration engine pushes progress/activeStop/playing from rAF ticks,
  // setTimeout, the keep-alive interval and SpeechSynthesisUtterance handlers.
  // `engineAlive` drops updates once this instance is torn down; `renderingRef`
  // defers an update by a microtask if it lands during the synchronous render
  // phase, preventing the "Cannot update while rendering" warning.
  const engineAlive = React.useRef(true);
  const renderingRef = React.useRef(false);
  renderingRef.current = true;
  if (typeof queueMicrotask === "function") {
    queueMicrotask(() => {
      renderingRef.current = false;
    });
  }
  React.useEffect(() => {
    renderingRef.current = false;
  });
  function safeSet<T>(setter: React.Dispatch<React.SetStateAction<T>>) {
    return (v: React.SetStateAction<T>) => {
      if (!engineAlive.current) return;
      if (renderingRef.current) {
        queueMicrotask(() => {
          if (engineAlive.current) setter(v);
        });
        return;
      }
      setter(v);
    };
  }
  const setActiveStop = safeSet(setActiveStop0);
  const setPlaying = safeSet(setPlaying0);
  const setProgress = safeSet(setProgress0);

  const [shareToast, setShareToast] = React.useState(false);
  const stopRefs = React.useRef<Record<number, HTMLElement | null>>({});

  // ── Narration timeline ──────────────────────────────────────────────────
  const segments = React.useMemo<Segment[]>(() => {
    const ordered = [...tour.stops].sort((a, b) => a.n - b.n);
    return ordered.map((s, i) => {
      const parts: string[] = [];
      if (i === 0 && tour.intro) parts.push(tour.intro);
      parts.push(s.blurb);
      if (i === ordered.length - 1 && tour.outro) parts.push(tour.outro);
      const text = parts.join(" ");
      const words = wordCount(text);
      return {
        stopIndex: i,
        text,
        words,
        estSec: Math.max(4, words / WORDS_PER_SEC),
      };
    });
  }, [tour]);

  const orderedStops = React.useMemo(
    () => [...tour.stops].sort((a, b) => a.n - b.n),
    [tour.stops]
  );

  const stopOffsets = React.useMemo(() => {
    const offs: number[] = [];
    let acc = 0;
    for (const seg of segments) {
      offs.push(acc);
      acc += seg.estSec;
    }
    return { offs, total: acc };
  }, [segments]);

  const speakState = React.useRef({
    chunkIdx: 0,
    chunks: [] as string[],
    segIdx: 0,
    totalChars: 0,
    charsBefore: 0,
    gotBoundary: false,
    boundaryTimer: 0 as number | ReturnType<typeof setTimeout>,
    fallbackRaf: 0,
    fallbackStart: 0,
    fallbackStartProg: 0,
    cancelled: false,
    active: false,
    keepAlive: 0 as number | ReturnType<typeof setInterval>,
  });
  const preferredVoice = React.useRef<SpeechSynthesisVoice | null>(null);
  const speakSegmentRef = React.useRef<(segIdx: number, fromProg: number) => void>(
    () => {}
  );

  const synth = (): SpeechSynthesis | null =>
    typeof window !== "undefined" && window.speechSynthesis
      ? window.speechSynthesis
      : null;

  const clearFallback = React.useCallback(() => {
    const st = speakState.current;
    if (st.fallbackRaf) {
      cancelAnimationFrame(st.fallbackRaf);
      st.fallbackRaf = 0;
    }
    if (st.boundaryTimer) {
      clearTimeout(st.boundaryTimer as ReturnType<typeof setTimeout>);
      st.boundaryTimer = 0;
    }
  }, []);

  const stopKeepAlive = React.useCallback(() => {
    const st = speakState.current;
    if (st.keepAlive) {
      clearInterval(st.keepAlive as ReturnType<typeof setInterval>);
      st.keepAlive = 0;
    }
  }, []);

  const startKeepAlive = React.useCallback(() => {
    const st = speakState.current;
    stopKeepAlive();
    st.keepAlive = setInterval(() => {
      const s = synth();
      if (!s || st.cancelled) return;
      if (s.speaking && !s.paused) {
        s.pause();
        s.resume();
      }
    }, 10000);
  }, [stopKeepAlive]);

  const hardStop = React.useCallback(() => {
    const st = speakState.current;
    st.cancelled = true;
    st.active = false;
    clearFallback();
    stopKeepAlive();
    const s = synth();
    if (s) s.cancel();
  }, [clearFallback, stopKeepAlive]);

  const runFallbackClock = React.useCallback(
    (segIdx: number, fromProg: number) => {
      const st = speakState.current;
      clearFallback();
      const seg = segments[segIdx];
      if (!seg) return;
      st.fallbackStart = performance.now();
      st.fallbackStartProg = fromProg;
      const tick = (now: number) => {
        if (st.cancelled) return;
        const elapsed = (now - st.fallbackStart) / 1000;
        const p = st.fallbackStartProg + elapsed / seg.estSec;
        if (p >= 1) {
          setProgress(0);
          if (segIdx < segments.length - 1) {
            const next = segIdx + 1;
            setActiveStop(orderedStops[next].n);
            speakSegmentRef.current(next, 0);
          } else {
            setPlaying(false);
            st.active = false;
            stopKeepAlive();
          }
          return;
        }
        setProgress(p);
        st.fallbackRaf = requestAnimationFrame(tick);
      };
      st.fallbackRaf = requestAnimationFrame(tick);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segments, orderedStops, clearFallback, stopKeepAlive]
  );

  const speakSegment = React.useCallback(
    (segIdx: number, fromProg: number) => {
      const st = speakState.current;
      const seg = segments[segIdx];
      if (!seg) {
        setPlaying(false);
        return;
      }
      const s = synth();
      if (!s) {
        st.cancelled = false;
        st.active = true;
        stopKeepAlive();
        runFallbackClock(segIdx, fromProg);
        return;
      }

      s.cancel();
      startKeepAlive();
      const chunks = chunkText(seg.text);
      const totalChars = chunks.join(" ").length || 1;
      const startChar = Math.floor(fromProg * totalChars);
      let acc = 0;
      let startChunk = 0;
      for (let i = 0; i < chunks.length; i++) {
        if (acc + chunks[i].length >= startChar) {
          startChunk = i;
          break;
        }
        acc += chunks[i].length + 1;
      }

      st.cancelled = false;
      st.active = true;
      st.segIdx = segIdx;
      st.chunks = chunks;
      st.chunkIdx = startChunk;
      st.totalChars = totalChars;
      st.charsBefore = chunks.slice(0, startChunk).reduce((n, c) => n + c.length + 1, 0);
      st.gotBoundary = false;

      const speakChunk = (idx: number) => {
        if (st.cancelled) return;
        if (idx >= st.chunks.length) {
          clearFallback();
          if (segIdx < segments.length - 1) {
            const next = segIdx + 1;
            setProgress(0);
            setActiveStop(orderedStops[next].n);
            speakSegmentRef.current(next, 0);
          } else {
            setProgress(1);
            setPlaying(false);
            st.active = false;
            stopKeepAlive();
          }
          return;
        }
        st.chunkIdx = idx;
        st.charsBefore = st.chunks
          .slice(0, idx)
          .reduce((n, c) => n + c.length + 1, 0);

        const u = new SpeechSynthesisUtterance(st.chunks[idx]);
        if (preferredVoice.current) u.voice = preferredVoice.current;
        u.rate = 1;
        u.pitch = 1;

        u.onboundary = (ev: SpeechSynthesisEvent) => {
          if (st.cancelled) return;
          st.gotBoundary = true;
          clearFallback();
          const ci = st.charsBefore + (ev.charIndex || 0);
          setProgress(Math.min(0.999, ci / st.totalChars));
        };
        u.onend = () => {
          if (st.cancelled) return;
          speakChunk(idx + 1);
        };
        u.onerror = () => {
          if (st.cancelled) return;
          if (!st.gotBoundary) {
            runFallbackClock(segIdx, st.charsBefore / st.totalChars);
          } else {
            speakChunk(idx + 1);
          }
        };

        try {
          s.speak(u);
        } catch {
          runFallbackClock(segIdx, st.charsBefore / st.totalChars);
          return;
        }

        if (idx === startChunk) {
          clearFallback();
          st.boundaryTimer = setTimeout(() => {
            if (st.cancelled || st.gotBoundary) return;
            runFallbackClock(segIdx, fromProg);
          }, BOUNDARY_GRACE_MS);
        }
      };

      speakChunk(startChunk);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      segments,
      orderedStops,
      runFallbackClock,
      clearFallback,
      startKeepAlive,
      stopKeepAlive,
    ]
  );

  React.useEffect(() => {
    speakSegmentRef.current = speakSegment;
  }, [speakSegment]);

  React.useEffect(() => {
    const s = synth();
    if (!s) return;
    const pick = () => {
      const voices = s.getVoices();
      if (!voices.length) return;
      preferredVoice.current =
        voices.find((v) => /en[-_]US/i.test(v.lang) && /female|samantha|natural/i.test(v.name)) ||
        voices.find((v) => /^en[-_]/i.test(v.lang) && v.localService) ||
        voices.find((v) => /^en[-_]/i.test(v.lang)) ||
        voices[0] ||
        null;
    };
    pick();
    s.addEventListener?.("voiceschanged", pick);
    return () => s.removeEventListener?.("voiceschanged", pick);
  }, []);

  React.useEffect(() => {
    return () => {
      hardStop();
    };
  }, [hardStop]);

  React.useEffect(() => {
    engineAlive.current = true;
    return () => {
      engineAlive.current = false;
    };
  }, []);

  const handleToggle = React.useCallback(() => {
    if (playing) {
      setPlaying(false);
      hardStop();
      return;
    }
    setPlaying(true);
    const segIdx = orderedStops.findIndex((s) => s.n === activeStop);
    speakState.current.cancelled = false;
    speakSegment(Math.max(0, segIdx), progress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, activeStop, progress, orderedStops, speakSegment, hardStop]);

  // When the active stop changes, smoothly scroll the page so the active card
  // is comfortably in view. (We use document scroll on mobile rather than an
  // inner-scroller, because the page itself scrolls.)
  React.useEffect(() => {
    const el = stopRefs.current[activeStop];
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 96 || r.bottom > window.innerHeight - 140) {
      const y = window.scrollY + r.top - 100;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }, [activeStop]);

  const handleStopClick = (n: number) => {
    setActiveStop(n);
    setProgress(0);
    if (playing) {
      const segIdx = orderedStops.findIndex((s) => s.n === n);
      speakState.current.cancelled = false;
      speakSegment(Math.max(0, segIdx), 0);
    }
  };

  const handlePrev = () => {
    const segIdx = orderedStops.findIndex((s) => s.n === activeStop);
    const target = Math.max(0, segIdx - 1);
    setProgress(0);
    setActiveStop(orderedStops[target].n);
    if (playing) {
      speakState.current.cancelled = false;
      speakSegment(target, 0);
    } else {
      hardStop();
    }
  };
  const handleNext = () => {
    const segIdx = orderedStops.findIndex((s) => s.n === activeStop);
    const target = Math.min(orderedStops.length - 1, segIdx + 1);
    setProgress(0);
    setActiveStop(orderedStops[target].n);
    if (playing) {
      speakState.current.cancelled = false;
      speakSegment(target, 0);
    } else {
      hardStop();
    }
  };

  const handleSeek = (p: number) => {
    const clamped = Math.max(0, Math.min(1, p));
    const targetSec = clamped * stopOffsets.total;
    let target = 0;
    for (let i = 0; i < segments.length; i++) {
      const end = stopOffsets.offs[i] + segments[i].estSec;
      if (targetSec < end || i === segments.length - 1) {
        target = i;
        break;
      }
    }
    const within =
      segments[target].estSec > 0
        ? Math.max(
            0,
            Math.min(0.999, (targetSec - stopOffsets.offs[target]) / segments[target].estSec)
          )
        : 0;
    setActiveStop(orderedStops[target].n);
    setProgress(within);
    if (playing) {
      speakState.current.cancelled = false;
      speakSegment(target, within);
    } else {
      hardStop();
    }
  };

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    setShareToast(true);
    setTimeout(() => setShareToast(false), 1800);
  };

  const current = tour.stops.find((s) => s.n === activeStop);
  const activeSegIdx = orderedStops.findIndex((s) => s.n === activeStop);
  const totalSec = stopOffsets.total;
  const globalSec =
    (activeSegIdx >= 0 ? stopOffsets.offs[activeSegIdx] : 0) +
    progress * (segments[Math.max(0, activeSegIdx)]?.estSec ?? 0);
  const fmtTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="screen tour">
      {/* HERO MAP */}
      <div className="tour-map-hero">
        <button
          className="map-back"
          onClick={() => router.push("/")}
          aria-label="Back"
        >
          ←
        </button>
        <button className="map-share" onClick={handleShare}>
          Share walk
        </button>
        {shareToast && <div className="map-toast">Link copied</div>}
        <MapComponent
          stops={tour.stops}
          route={routePts}
          routeLngLat={tour.routeLngLat}
          activeStop={activeStop}
          onStopClick={handleStopClick}
          accent={ACCENT}
          areas={tour.areas}
          label={tour.city}
          subLabel={mapSubLabel}
        />
      </div>

      {/* TOUR HEAD */}
      <header className="tour-head">
        <div className="eyebrow">{tour.duration}-min walk</div>
        <h1>
          {tour.city}
          <br />
          <span className="region">{tour.region}</span>
        </h1>
        <div className="tour-meta-row">
          <span>
            <span className="v">{tour.distanceMi}</span> mi
          </span>
          <span className="dot" />
          <span>
            <span className="v">{tour.stops_count}</span> stops
          </span>
          <span className="dot" />
          <span>{tour.tags.join(" · ")}</span>
        </div>
      </header>
      <p className="tour-blurb">{tour.intro}</p>

      {/* STOPS */}
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
            <div className="stop-rail">
              <div className="stop-num">{s.n}</div>
              <div className="stop-line" />
              <div className="stop-walk">+{s.walkMin}m</div>
            </div>
            <div className="stop-body">
              <div className="stop-type">{s.type}</div>
              <h2 className="stop-name">{s.name}</h2>
              <StopPhoto name={s.name} photoUrl={s.photoUrl} />
              <p className="stop-blurb">{s.blurb}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="tour-outro">
        <span className="label">End of walk</span>
        <p>{tour.outro}</p>
      </div>

      <AudioBar
        playing={playing}
        onToggle={handleToggle}
        current={current}
        globalSec={globalSec}
        totalSec={totalSec}
        fmtTime={fmtTime}
        accent={ACCENT}
        totalStops={tour.stops.length}
        onSeek={handleSeek}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </div>
  );
}
