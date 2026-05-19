// Geometry helpers shared across the pipeline.

export interface LatLng {
  lat: number;
  lng: number;
}

const R_EARTH_M = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

// Great-circle distance in metres.
export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.sqrt(h));
}

// Search radius from duration (pace-based, PRD §15 default). Divisor 3.82 =
// dwell(/0.80) x street-detour(x1.30) / out-and-back half-extent(0.50 x 0.85
// inner-packing); old /3.2 + 1700 cap overshot the requested time.
export function radiusForDuration(durationMin: number): number {
  const walkedM = (durationMin / 60) * 4500; // ~4.5 km/h pace
  const r = walkedM / 3.82;
  return Math.round(Math.min(2400, Math.max(450, r)));
}

// Project a set of lat/lng into a padded 0..1 box (north = up, so y inverts).
export function makeProjector(points: LatLng[]) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);

  // Pad so markers never sit on the edge; keep aspect roughly square.
  const padLat = Math.max((maxLat - minLat) * 0.18, 0.0008);
  const padLng = Math.max((maxLng - minLng) * 0.18, 0.0008);
  minLat -= padLat;
  maxLat += padLat;
  minLng -= padLng;
  maxLng += padLng;

  const spanLat = maxLat - minLat || 1e-6;
  const spanLng = maxLng - minLng || 1e-6;

  return {
    bounds: {
      lat: [minLat, maxLat] as [number, number],
      lng: [minLng, maxLng] as [number, number],
    },
    project(p: LatLng): { x: number; y: number } {
      return {
        x: (p.lng - minLng) / spanLng,
        y: 1 - (p.lat - minLat) / spanLat,
      };
    },
  };
}

const STOPWORDS = new Set(["the", "a", "of", "and", "los", "san", "la", "le"]);

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

export function tourSlug(city: string, tags: string[]): string {
  const t = tags
    .join("-")
    .split(/[\s,]+/)
    .filter((w) => !STOPWORDS.has(w))
    .join("-");
  return slugify(`${city}-${t}`);
}

const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export function shortId(seed: string): string {
  // Deterministic-ish 7-char id from the content hash so identical inputs
  // produce the same URL (exact-match cache — PRD §15 default).
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  let out = "";
  for (let i = 0; i < 7; i++) {
    out += ALPHABET[h % ALPHABET.length];
    h = Math.floor(h / ALPHABET.length) ^ Math.imul(h, 2654435761);
    h = h >>> 0;
  }
  return out;
}

export function contentHash(
  location: string,
  duration: number,
  tags: string[]
): string {
  return `${location.trim().toLowerCase()}|${duration}|${[...tags]
    .sort()
    .join(",")}`;
}
