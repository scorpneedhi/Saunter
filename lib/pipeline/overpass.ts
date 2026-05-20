// Step 2 — query OSM (Overpass) for POI candidates matching the user's
// interest tags within the walking radius, plus park/water polygons so the
// map is grounded in real geography rather than decoration.

import { postOverpass, PipelineError } from "./http";
import { latinize } from "./geocode";
import type { LatLng } from "./geo";

export type Interest =
  | "history"
  | "architecture"
  | "public art"
  | "hidden gems"
  | "food and drink"
  | "nature";

// A curated bundle of descriptive OSM tags kept so that coverage-thin stops
// (no Wikipedia article) still have something concrete to narrate from.
// Only keys actually present on the element are populated.
export interface OsmFacts {
  description?: string;
  historic?: string;
  start_date?: string;
  architect?: string;
  street?: string; // from tags["addr:street"]
  inscription?: string;
  building?: string;
  tourism?: string;
  religion?: string;
  operator?: string;
  heritage?: string;
}

export interface Candidate {
  osmId: string;
  name: string;
  lat: number;
  lng: number;
  typeLabel: string; // human label e.g. "Place of worship"
  interests: Interest[]; // which requested interests this matched
  hasWiki: boolean; // has wikipedia/wikidata tag → richer, ranks higher
  wikipedia?: string; // "en:Article Title"
  wikidata?: string;
  osm?: OsmFacts; // descriptive tags retained for thin-coverage narration
}

export interface AreaPoly {
  kind: "park" | "water";
  pts: LatLng[];
}

// OSM tag filters per interest. Kept conservative so candidates are real
// places, not noise.
const FILTERS: Record<Interest, string[]> = {
  history: [
    'node["historic"]',
    'way["historic"]',
    'node["tourism"="museum"]',
    'way["tourism"="museum"]',
    'way["heritage"]',
  ],
  architecture: [
    'node["amenity"="place_of_worship"]',
    'way["amenity"="place_of_worship"]',
    'way["building"~"church|cathedral|chapel|temple|mosque|synagogue"]',
    'node["man_made"~"tower|lighthouse"]',
    'way["building"]["architect"]',
    'node["tourism"="attraction"]',
    'way["tourism"="attraction"]',
  ],
  "public art": [
    'node["tourism"="artwork"]',
    'way["tourism"="artwork"]',
    'node["historic"="memorial"]["memorial"~"statue|sculpture"]',
  ],
  "hidden gems": [
    'node["tourism"="viewpoint"]',
    'node["tourism"="attraction"]',
    'node["amenity"="fountain"]',
    'node["historic"]',
  ],
  "food and drink": [
    'node["amenity"~"cafe|bar|pub"]["name"]',
    'node["amenity"="restaurant"]["name"]',
    'node["shop"~"bakery|coffee"]["name"]',
  ],
  nature: [
    'way["leisure"~"park|garden"]',
    'node["tourism"="viewpoint"]',
    'way["natural"="water"]',
    'node["natural"="peak"]',
  ],
};

const TYPE_LABELS: { test: (t: Record<string, string>) => boolean; label: string }[] = [
  { test: (t) => t.amenity === "place_of_worship", label: "Place of worship" },
  { test: (t) => t.tourism === "museum", label: "Museum" },
  { test: (t) => t.tourism === "artwork", label: "Public art" },
  { test: (t) => t.tourism === "viewpoint", label: "Viewpoint" },
  { test: (t) => t.tourism === "attraction", label: "Attraction" },
  { test: (t) => !!t.historic, label: "Historic site" },
  { test: (t) => t.leisure === "park" || t.leisure === "garden", label: "Park" },
  { test: (t) => t.natural === "water", label: "Water" },
  { test: (t) => t.amenity === "cafe", label: "Café" },
  { test: (t) => t.amenity === "bar" || t.amenity === "pub", label: "Bar" },
  { test: (t) => t.amenity === "restaurant", label: "Restaurant" },
  { test: (t) => !!t.building, label: "Building" },
];

function labelFor(tags: Record<string, string>): string {
  for (const { test, label } of TYPE_LABELS) if (test(tags)) return label;
  return "Place";
}

// Pick only the descriptive keys we care about, only when present and
// non-empty, so narration can ground thin-coverage stops in real facts
// without fabricating anything.
function osmFactsFor(tags: Record<string, string>): OsmFacts | undefined {
  const f: OsmFacts = {};
  const put = (k: keyof OsmFacts, v: string | undefined) => {
    const t = v?.trim();
    if (t) f[k] = t;
  };
  put("description", tags.description);
  put("historic", tags.historic);
  put("start_date", tags.start_date);
  put("architect", tags.architect);
  put("street", tags["addr:street"]);
  put("inscription", tags.inscription);
  put("building", tags.building);
  put("tourism", tags.tourism);
  put("religion", tags.religion);
  put("operator", tags.operator);
  put("heritage", tags.heritage);
  return Object.keys(f).length ? f : undefined;
}

interface OverpassEl {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

export async function fetchCandidates(
  center: LatLng,
  radiusM: number,
  interests: Interest[]
): Promise<{ candidates: Candidate[]; areas: AreaPoly[] }> {
  const A = `${radiusM},${center.lat},${center.lng}`;

  const poiStmts = interests
    .flatMap((it) => FILTERS[it])
    .map((f) => `${f}(around:${A});`)
    .join("\n");

  // Areas for the map backdrop (small cap; geometry is heavy).
  const areaStmts = [
    `way["leisure"~"park|garden"](around:${A});`,
    `way["natural"="water"](around:${A});`,
    `way["water"](around:${A});`,
  ].join("\n");

  const query = `
[out:json][timeout:25];
(
${poiStmts}
);
out center tags 200;
(
${areaStmts}
);
out geom 40;
`;

  let data: { elements: OverpassEl[] };
  try {
    data = await postOverpass<{ elements: OverpassEl[] }>(query);
  } catch {
    throw new PipelineError("overpass", "OpenStreetMap lookup timed out.");
  }

  const candidates: Candidate[] = [];
  const areas: AreaPoly[] = [];
  const seen = new Set<string>();

  for (const el of data.elements || []) {
    const tags = el.tags || {};

    // Area element (has geometry, park/water tags, used for the map).
    if (el.geometry && el.geometry.length >= 3) {
      const isWater = tags.natural === "water" || !!tags.water;
      const isPark = tags.leisure === "park" || tags.leisure === "garden";
      if (isWater || isPark) {
        areas.push({
          kind: isWater ? "water" : "park",
          pts: el.geometry.map((g) => ({ lat: g.lat, lng: g.lon })),
        });
      }
      continue;
    }

    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    // Prefer the OSM English variant; fall back to the localized name or
    // artist name. Latinize whichever wins so stops never render as e.g.
    // "북촌한옥마을 ДЕРЕВНЯ" — the namedetails shim re-uses any name:en /
    // name:en-US already on the element when the chosen string is non-Latin.
    const rawName = tags["name:en"] || tags.name || tags.artist_name;
    if (lat == null || lng == null || !rawName) continue;
    const name = latinize(rawName, tags);

    const key = `${name.toLowerCase()}@${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const matched = interests.filter((it) =>
      FILTERS[it].some((f) => filterMatches(f, tags))
    );
    if (matched.length === 0) continue;

    candidates.push({
      osmId: `${el.type}/${el.id}`,
      name,
      lat,
      lng,
      typeLabel: labelFor(tags),
      interests: matched.length ? matched : [interests[0]],
      hasWiki: !!(tags.wikipedia || tags.wikidata),
      wikipedia: tags.wikipedia,
      wikidata: tags.wikidata,
      osm: osmFactsFor(tags),
    });
  }

  if (candidates.length < 4) {
    throw new PipelineError(
      "overpass",
      "Too few notable places here — try a denser, more central neighborhood."
    );
  }

  return { candidates, areas };
}

// Lightweight check that an element's tags satisfy an Overpass filter string
// like `node["amenity"~"cafe|bar"]["name"]`. Good enough to attribute which
// interest a candidate matched.
function filterMatches(filter: string, tags: Record<string, string>): boolean {
  const clauses = filter.match(/\["[^"]+"(?:[~=]"[^"]+")?\]/g) || [];
  for (const c of clauses) {
    const m = c.match(/\["([^"]+)"(?:([~=])"([^"]+)")?\]/);
    if (!m) continue;
    const [, key, op, val] = m;
    const tv = tags[key];
    if (tv == null) return false;
    if (op === "=" && tv !== val) return false;
    if (op === "~" && !new RegExp(val).test(tv)) return false;
  }
  return clauses.length > 0;
}
