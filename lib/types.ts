// Domain types for Saunter. Presentational components read only from these;
// no fetching logic lives in components (PRD §8, requirement 5).

export type PhotoTone = "warm-grey" | "brick" | "sage" | "cream";

export type InterestTag =
  | "history"
  | "architecture"
  | "public art"
  | "hidden gems"
  | "food and drink"
  | "nature";

export type Duration = 30 | 60 | 90 | 120;

export interface Stop {
  n: number;
  name: string;
  type: string;
  coord: { x: number; y: number }; // 0..1 normalized in the paper-map coord space
  blurb: string;
  photoTone: PhotoTone;
  walkMin: number;
  // Present on pipeline-generated tours (absent on the static mock).
  lat?: number;
  lng?: number;
  photoUrl?: string; // Wikimedia Commons image where available
  sourceUrl?: string; // Wikipedia article the blurb is grounded in
}

// Park / water polygons fetched from OSM, projected into 0..1 map space.
export interface MapArea {
  kind: "park" | "water";
  points: [number, number][];
}

export interface Tour {
  city: string;
  region: string;
  slug: string;
  duration: number;
  distanceKm: number;
  distanceMi: number;
  stops_count: number;
  tags: string[];
  weather: string;
  bestTime: string;
  intro: string;
  outro: string;
  bounds: { lat: [number, number]; lng: [number, number] };
  stops: Stop[];
  // Present on pipeline-generated tours.
  id?: string;
  center?: { lat: number; lng: number };
  areas?: MapArea[];
  route?: RoutePoint[]; // projected walking polyline (0..1 space)
  routeLngLat?: [number, number][]; // raw OSRM polyline [lng, lat], for MapLibre
  narrated?: boolean; // true when the LLM voice pass ran (vs. grounded fallback)
}

// Route as a sequence of [x, y] points in the same 0..1 space as stops.
export type RoutePoint = [number, number];

export interface ExampleTour {
  n: string;
  city: string;
  region: string;
  min: number;
  tags: string;
  tone: "ochre" | "terra" | "ink" | "rose" | "sage" | "brick" | "stone";
  span: "wide" | "tall";
}
