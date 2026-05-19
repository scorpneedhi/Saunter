// Step 4 — compute a pedestrian route through the ordered stops (OSRM).

import { getJSON } from "./http";
import type { LatLng } from "./geo";

export interface RouteResult {
  // Per-stop cumulative walking minutes from the first stop (stop 1 = 0).
  walkMin: number[];
  distanceM: number;
  // Route polyline as lat/lng (projected to 0..1 later).
  polyline: LatLng[];
}

interface OsrmResp {
  code: string;
  routes: {
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
    legs: { distance: number; duration: number }[];
  }[];
}

export async function computeRoute(stops: LatLng[]): Promise<RouteResult> {
  const coords = stops.map((s) => `${s.lng},${s.lat}`).join(";");
  const url =
    `https://router.project-osrm.org/route/v1/foot/${coords}` +
    `?overview=full&geometries=geojson&steps=false&annotations=false`;

  try {
    const data = await getJSON<OsrmResp>(url, { timeoutMs: 15000 });
    if (data.code !== "Ok" || !data.routes?.length) throw new Error(data.code);
    const r = data.routes[0];

    const walkMin: number[] = [0];
    let acc = 0;
    for (const leg of r.legs) {
      acc += leg.duration / 60;
      walkMin.push(Math.round(acc));
    }

    return {
      walkMin,
      distanceM: r.distance,
      polyline: r.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    };
  } catch {
    // OSRM down or refused — fall back to straight legs at a 4.5 km/h pace
    // so the tour still renders (PRD: generation must not hard-fail here).
    return straightLineFallback(stops);
  }
}

function straightLineFallback(stops: LatLng[]): RouteResult {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dist = (a: LatLng, b: LatLng) => {
    const R = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const walkMin = [0];
  let total = 0;
  let acc = 0;
  for (let i = 1; i < stops.length; i++) {
    const d = dist(stops[i - 1], stops[i]) * 1.3; // street detour factor
    total += d;
    acc += d / 75; // ~4.5 km/h → 75 m/min
    walkMin.push(Math.round(acc));
  }
  return { walkMin, distanceM: total, polyline: stops };
}
