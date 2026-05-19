// Step 1 — geocode the user's free-text location via Nominatim (OSM).

import { getJSON, PipelineError } from "./http";
import type { LatLng } from "./geo";

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  addresstype?: string;
  type?: string;
  class?: string;
  address?: Record<string, string>;
}

export interface GeocodeResult extends LatLng {
  city: string;
  region: string;
  displayName: string;
}

export async function geocode(query: string): Promise<GeocodeResult> {
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=1&q=" +
    encodeURIComponent(query.trim());

  let results: NominatimResult[];
  try {
    results = await getJSON<NominatimResult[]>(url, { timeoutMs: 12000 });
  } catch (e) {
    throw new PipelineError(
      "geocode",
      `Couldn't reach the geocoder for "${query}".`
    );
  }

  if (!results || results.length === 0) {
    throw new PipelineError(
      "geocode",
      `We couldn't find "${query}". Try a neighborhood and city.`
    );
  }

  const r = pickBest(results, query);
  const a = r.address || {};
  const city =
    r.name ||
    a.neighbourhood ||
    a.suburb ||
    a.quarter ||
    a.city_district ||
    a.city ||
    a.town ||
    a.village ||
    query.split(",")[0].trim();
  const region =
    a.city ||
    a.town ||
    a.county ||
    a.state ||
    a.country ||
    r.display_name.split(",").slice(1, 2).join("").trim();

  return {
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    city: titleCase(city),
    region: titleCase(region),
    displayName: r.display_name,
  };
}

// Nominatim returns POIs (shops, offices) ahead of the place when the query
// is ambiguous; prefer place/boundary-class results that share query tokens,
// falling back to results[0] when nothing scores higher.
const PLACE_CLASSES = new Set(["place", "boundary"]);
const PLACE_TYPES = new Set([
  "city",
  "town",
  "village",
  "suburb",
  "neighbourhood",
  "quarter",
  "borough",
  "city_district",
  "administrative",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

function score(r: NominatimResult, qTokens: string[]): number {
  let s = 0;
  if (r.class && PLACE_CLASSES.has(r.class)) s += 3;
  const pType = r.type || r.addresstype;
  if (pType && PLACE_TYPES.has(pType)) s += 3;
  const hay = `${r.name ?? ""} ${r.display_name}`.toLowerCase();
  for (const t of qTokens) if (hay.includes(t)) s += 1;
  return s;
}

function pickBest(results: NominatimResult[], query: string): NominatimResult {
  const qTokens = tokens(query);
  let best = results[0];
  let bestScore = score(best, qTokens);
  for (let i = 1; i < results.length; i++) {
    const s = score(results[i], qTokens);
    if (s > bestScore) {
      best = results[i];
      bestScore = s;
    }
  }
  return best;
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .trim();
}
