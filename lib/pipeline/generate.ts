// The generation pipeline orchestrator.
//
//   input → Nominatim → Overpass → rank/select → OSRM
//         → Wikipedia/Commons → narration → cache → Tour
//
// The LLM only writes voice; it never chooses places (PRD §8.2).

import type { Tour, Stop, MapArea } from "../types";
import {
  contentHash,
  makeProjector,
  radiusForDuration,
  shortId,
  slugify,
  tourSlug,
  type LatLng,
} from "./geo";
import { PipelineError } from "./http";
import { geocode } from "./geocode";
import { fetchCandidates, type Interest } from "./overpass";
import { selectStops } from "./rank";
import { computeRoute } from "./route";
import { enrich } from "./enrich";
import { narrate, toneFor } from "./narrate";
import { getByHash, save, type TourRecord } from "./cache";
import { log } from "../log";

export interface GenerateInput {
  location: string;
  duration: number;
  tags: Interest[];
}

export interface GenerateOutput {
  id: string;
  citySlug: string;
  slug: string; // `${tour-slug}-${id}` — the [slug] route param
}

// Wraps each pipeline step: measures wall-clock ms and emits one structured
// log line, then re-raises any error untouched. Purely observational — it
// never changes the value, ordering, or failure behavior of `fn`. Timing is
// log-only (not persisted); see docs/metrics.sql for why.
async function withTiming<T>(step: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    log.info("step.timing", { step, ms: Date.now() - start, ok: true });
    return result;
  } catch (e) {
    log.warn("step.timing", {
      step,
      ms: Date.now() - start,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

export async function generateTour(
  input: GenerateInput
): Promise<GenerateOutput> {
  const location = input.location.trim();
  const tags = input.tags.slice(0, 3);
  if (!location) throw new PipelineError("input", "Tell us where to walk.");
  if (tags.length === 0)
    throw new PipelineError("input", "Pick at least one thing to look for.");

  const hash = contentHash(location, input.duration, tags);
  const cached = await getByHash(hash);
  if (cached) {
    return {
      id: cached.id,
      citySlug: slugify(cached.tour.city),
      slug: cached.tour.slug,
    };
  }

  // 1. Geocode
  const geo = await withTiming("geocode", () => geocode(location));
  const center: LatLng = { lat: geo.lat, lng: geo.lng };

  // 2. POI candidates + map areas within the pace-based radius
  const radius = radiusForDuration(input.duration);
  const { candidates, areas } = await withTiming("overpass", () =>
    fetchCandidates(center, radius, tags)
  );

  // 3. Score, select, order (deterministic — not the LLM)
  const selected = await withTiming("select", async () =>
    selectStops(candidates, center, input.duration)
  );
  if (selected.length < 4) {
    throw new PipelineError(
      "select",
      "Not enough notable places here for a walk. Try a denser area."
    );
  }

  // 4. Pedestrian route through the ordered stops
  const route = await withTiming("route", () =>
    computeRoute(selected.map((s) => ({ lat: s.lat, lng: s.lng })))
  );

  // 5. Wikipedia summary + Commons image per stop
  const enriched = await withTiming("enrich", () => enrich(selected));

  // 6. Narration grounded in the retrieved text (LLM or fallback)
  const narration = await withTiming("narrate", () =>
    narrate(enriched, geo.city, geo.region, tags, input.duration)
  );

  // Project everything into the 0..1 paper-map space.
  const proj = makeProjector([
    center,
    ...enriched.map((e) => ({ lat: e.lat, lng: e.lng })),
    ...route.polyline,
  ]);

  const stops: Stop[] = enriched.map((e, i) => {
    const p = proj.project({ lat: e.lat, lng: e.lng });
    return {
      n: i + 1,
      name: e.name,
      type: e.typeLabel,
      coord: p,
      blurb: narration.blurbs[i],
      photoTone: toneFor(e.typeLabel),
      walkMin: route.walkMin[i] ?? 0,
      lat: e.lat,
      lng: e.lng,
      photoUrl: e.photoUrl,
      sourceUrl: e.sourceUrl,
    };
  });

  const mapAreas: MapArea[] = areas
    .filter((a) => a.pts.length >= 3)
    .slice(0, 24)
    .map((a) => ({
      kind: a.kind,
      points: a.pts.map((pt) => {
        const p = proj.project(pt);
        return [clamp01(p.x), clamp01(p.y)] as [number, number];
      }),
    }));

  const routePts = route.polyline.map((pt) => {
    const p = proj.project(pt);
    return [p.x, p.y] as [number, number];
  });

  const id = shortId(hash);
  const baseSlug = tourSlug(geo.city, tags);
  const slug = `${baseSlug}-${id}`;
  const km = route.distanceM / 1000;

  const tour: Tour = {
    id,
    city: geo.city,
    region: geo.region,
    slug,
    duration: input.duration,
    distanceKm: round1(km),
    distanceMi: round1(km * 0.621371),
    stops_count: stops.length,
    tags,
    weather: "",
    bestTime: "",
    intro: narration.intro,
    outro: narration.outro,
    bounds: proj.bounds,
    stops,
    center,
    areas: mapAreas,
    route: routePts,
    routeLngLat: route.polyline.map((p) => [p.lng, p.lat] as [number, number]),
    narrated: narration.narrated,
  };

  const rec: TourRecord = { id, hash, tour };
  await save(rec);

  return { id, citySlug: slugify(geo.city), slug };
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const clamp01 = (n: number) => Math.max(-0.2, Math.min(1.2, n));
