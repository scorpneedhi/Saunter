"use client";

// Tour page — the heart of the product.
// Map fills the top on mobile (sticky), the stop list scrolls below,
// a fixed transistor-radio audio bar sits at the bottom.
// Drop cap on intro is locked on (the tweak the user landed on).

import React from "react";
import { useRouter } from "next/navigation";
import { PaperMap } from "./PaperMap";
import { MapLibreMap } from "./MapLibreMap";
import { StopPhoto } from "./StopPhoto";
import { AudioBar } from "./AudioBar";
import type { Tour as TourType, RoutePoint } from "@/lib/types";

const ACCENT = "#2e4a32"; // deep forest

// MapLibre is opt-in; the SVG PaperMap stays the default visual reference.
// Per-tour selection happens in the component: MapLibre needs real
// coordinates, so coordinate-less tours (the static mock) keep the SVG map
// even with the flag on.
const USE_MAPLIBRE = process.env.NEXT_PUBLIC_USE_MAPLIBRE === "1";

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
  // MapLibre only for tours with real geography; the static/mock tour has no
  // stop lat/lng, so it falls back to the SVG PaperMap even when the flag is on.
  const hasGeo = tour.stops.some(
    (s) => typeof s.lat === "number" && typeof s.lng === "number"
  );
  const MapComponent = USE_MAPLIBRE && hasGeo ? MapLibreMap : PaperMap;
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
  // setTimeout, the keep-alive interval and SpeechSynthesisUtterance
  // onboundary/onend/onerror handlers. Those callbacks outlive any single
  // render: across a Fast Refresh in-place re-render (or a StrictMode /
  // concurrent re-render), a still-live callback can fire its setter against
  // the *previous* Tour fiber while a fresh Tour fiber is mid-render — React's
  // "Cannot update a component (Tour) while rendering a different component
  // (Tour)" warning. `engineAlive` drops updates once this instance is torn
  // down; `renderingRef` defers an update by a microtask if it lands during
  // the synchronous render phase. Both keep audio behavior identical (the
  // deferral is sub-frame; speech calls are never gated, only React state).
  const engineAlive = React.useRef(true);
  const renderingRef = React.useRef(false);
  renderingRef.current = true;
  // Flip the flag back the instant the synchronous render stack unwinds —
  // before any rAF/timer/speech event for this frame can run.
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
  const listRef = React.useRef<HTMLDivElement>(null);
  const userScrolling = React.useRef(false);

  // ── Narration timeline ──────────────────────────────────────────────────
  // Sequence: tour.intro → each stop.blurb in order → tour.outro.
  // intro is folded onto the first stop and outro onto the last stop so the
  // existing per-stop `activeStop` / `progress` model is preserved exactly.
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

  // Per-stop estimated seconds — feeds ONLY the cosmetic globalSec/totalSec
  // readout (SpeechSynthesis has no real duration API).
  const stopOffsets = React.useMemo(() => {
    const offs: number[] = [];
    let acc = 0;
    for (const seg of segments) {
      offs.push(acc);
      acc += seg.estSec;
    }
    return { offs, total: acc };
  }, [segments]);

  // Mutable speech state lives in refs so the click handler can call
  // speechSynthesis.speak() synchronously (mobile-Safari gesture rule) without
  // waiting on React state/effects.
  const speakState = React.useRef({
    // index into the *current* segment's chunk array
    chunkIdx: 0,
    chunks: [] as string[],
    segIdx: 0,
    // total chars of the current segment, for onboundary progress math
    totalChars: 0,
    charsBefore: 0,
    gotBoundary: false,
    boundaryTimer: 0 as number | ReturnType<typeof setTimeout>,
    fallbackRaf: 0,
    fallbackStart: 0,
    fallbackStartProg: 0,
    cancelled: false,
    active: false,
    // Chrome pauses the engine on long total speech even with chunking; a
    // periodic pause()/resume() ping keeps the queue alive.
    keepAlive: 0 as number | ReturnType<typeof setInterval>,
  });
  const preferredVoice = React.useRef<SpeechSynthesisVoice | null>(null);
  // Breaks the runFallbackClock ⇄ speakSegment dependency cycle (both are
  // useCallbacks; the fallback clock needs to re-enter speakSegment when it
  // rolls over to the next stop).
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

  // Chrome workaround: ping pause()+resume() every ~10s while we have speech
  // queued so the engine doesn't silently stall on long total narration.
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

  // Wall-clock fallback used when `onboundary` never fires (Safari) OR when
  // SpeechSynthesis is entirely unavailable. Drives progress from
  // elapsed ÷ estimatedSeconds and auto-advances stops the same way.
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
            // continue the chain in whatever mode this stop ends up using
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
    [segments, orderedStops, clearFallback, stopKeepAlive]
  );

  // Speak segment `segIdx`, starting `fromProg` (0..1) of the way through it.
  // The first speak() in any user gesture reaches this synchronously.
  const speakSegment = React.useCallback(
    (segIdx: number, fromProg: number) => {
      const st = speakState.current;
      const seg = segments[segIdx];
      if (!seg) {
        setPlaying(false);
        return;
      }
      const s = synth();
      // No SpeechSynthesis at all → pure wall-clock so the UI is never dead.
      if (!s) {
        st.cancelled = false;
        st.active = true;
        stopKeepAlive();
        runFallbackClock(segIdx, fromProg);
        return;
      }

      s.cancel(); // clear anything queued before we re-speak
      startKeepAlive();
      const chunks = chunkText(seg.text);
      const totalChars = chunks.join(" ").length || 1;
      // Where to resume from, at chunk granularity.
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
          // Segment finished → advance to next stop or stop playback.
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
          clearFallback(); // boundary works → kill any wall-clock fallback
          const ci = st.charsBefore + (ev.charIndex || 0);
          setProgress(Math.min(0.999, ci / st.totalChars));
        };
        u.onend = () => {
          if (st.cancelled) return;
          speakChunk(idx + 1);
        };
        u.onerror = () => {
          if (st.cancelled) return;
          // engine hiccup — fall back to the clock for the rest of this stop
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

        // Arm the no-boundary fallback only on the very first chunk: if no
        // onboundary has fired shortly after speech starts (Safari), advance
        // the bar by wall clock instead. Speech keeps playing; we just stop
        // relying on boundary events for the scrubber.
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
    [
      segments,
      orderedStops,
      runFallbackClock,
      clearFallback,
      startKeepAlive,
      stopKeepAlive,
    ]
  );

  // Keep the indirection ref pointed at the live speakSegment so the
  // fallback-clock rollover and segment-finished paths re-enter correctly.
  React.useEffect(() => {
    speakSegmentRef.current = speakSegment;
  }, [speakSegment]);

  // Load voices without blocking playback. Picks a preferred en voice when
  // the list arrives; playback never waits on this.
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

  // Cleanup on unmount: never leave the synth talking after navigation.
  React.useEffect(() => {
    return () => {
      hardStop();
    };
  }, [hardStop]);

  // Lifecycle gate for engine→state updates. Tied to mount/unmount only (not
  // hardStop identity) so a torn-down or Fast-Refresh-replaced instance can't
  // setState from a still-live rAF/timer/utterance callback. Re-arms on a
  // StrictMode remount.
  React.useEffect(() => {
    engineAlive.current = true;
    return () => {
      engineAlive.current = false;
    };
  }, []);

  // Toggle play/pause. CRITICAL: when starting, speechSynthesis.speak() is
  // reached synchronously inside this handler (the click event) — no await,
  // no deferred effect — to satisfy the mobile-Safari user-gesture rule.
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
  }, [playing, activeStop, progress, orderedStops, speakSegment, hardStop]);

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
    if (playing) {
      // Re-target narration to the clicked stop. cancel() happens inside
      // speakSegment before the new utterance, per the cleanup contract.
      const segIdx = orderedStops.findIndex((s) => s.n === n);
      speakState.current.cancelled = false;
      speakSegment(Math.max(0, segIdx), 0);
    }
  };

  // Jump to next/prev stop, restarting narration there if playing.
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

  // onSeek(p): p is 0..1 over the WHOLE tour timeline. Map it onto the
  // estimated-seconds layout to find the stop, jump activeStop there, and
  // (if playing) resume speaking from that stop's start.
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
    setTimeout(() => setShareToast(false), 2000);
  };

  const current = tour.stops.find((s) => s.n === activeStop);
  // NOTE: SpeechSynthesis has no duration API — totalSec/globalSec are a
  // synthetic estimate (word count ÷ ~2.7 wps) purely for the mm:ss readout.
  // The scrubber FILL is driven by real onboundary `progress`, not the clock.
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
        onToggle={handleToggle}
        current={current}
        globalSec={globalSec}
        totalSec={totalSec}
        fmtTime={fmtTime}
        accent={ACCENT}
        onSeek={handleSeek}
        onPrev={handlePrev}
        onNext={handleNext}
      />
    </div>
  );
}
