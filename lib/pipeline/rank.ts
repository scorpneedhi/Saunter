// Step 3 — score, select, and order stops.
// The AI never picks stops: this deterministic ranker does (PRD §8.2).

import { haversine, type LatLng } from "./geo";
import type { Candidate } from "./overpass";

// "Substantial" place types are worth more than a coffee shop.
const TYPE_WEIGHT: Record<string, number> = {
  Museum: 4,
  "Place of worship": 3.5,
  "Public art": 3.5,
  "Historic site": 3,
  Viewpoint: 3,
  Attraction: 2.5,
  Park: 2,
  Building: 1.5,
  Restaurant: 1,
  Café: 0.8,
  Bar: 0.8,
  Place: 0.5,
  Water: 0,
};

function score(c: Candidate): number {
  let s = 1;
  if (c.hasWiki) s += 4; // OSM completeness — Wikipedia-tagged ranks higher
  s += c.interests.length * 1.5; // matches more of what they asked for
  s += TYPE_WEIGHT[c.typeLabel] ?? 1;
  return s;
}

// Stop count tuned by duration and density (PRD §15 default: pace-based,
// count by density). 5–10 stops.
function targetCount(durationMin: number, available: number): number {
  const byTime = Math.round(durationMin / 14); // ~14 min per stop incl. walking
  return Math.max(5, Math.min(10, Math.min(byTime, available)));
}

export function selectStops(
  candidates: Candidate[],
  center: LatLng,
  durationMin: number
): Candidate[] {
  const scored = candidates
    .map((c) => ({ c, s: score(c) }))
    .sort((a, b) => b.s - a.s);

  const want = targetCount(durationMin, scored.length);

  // No single type may exceed ~40% of the final set, but always allow at
  // least 2 (so a 5-stop walk tolerates 2 of a type, not 1).
  const typeCap = Math.max(2, Math.ceil(want * 0.4));
  const typeCounts = new Map<string, number>();
  const bump = (c: Candidate) =>
    typeCounts.set(c.typeLabel, (typeCounts.get(c.typeLabel) ?? 0) + 1);

  // Greedy pick: take the strongest, then keep adding the candidate that
  // best balances its own score against spreading away from chosen stops
  // and covering interests not yet represented, so the walk isn't seven
  // things on one corner all of the same kind.
  const chosen: Candidate[] = [];
  if (scored.length === 0) return chosen;
  chosen.push(scored[0].c);
  bump(scored[0].c);

  const coveredInterests = new Set<string>(scored[0].c.interests);

  while (chosen.length < want) {
    let best: { c: Candidate; v: number } | null = null;
    let bestUncapped: { c: Candidate; v: number } | null = null;
    for (const { c, s } of scored) {
      if (chosen.includes(c)) continue;
      const nearest = Math.min(...chosen.map((k) => haversine(c, k)));
      // Reward score; reward being a sensible 120–450m hop from others.
      const spread = Math.min(nearest, 450) / 450;
      // Reward covering a requested interest not yet in the set, weighted
      // a little above the spread term so type/interest variety leads.
      const addsInterest = c.interests.some((i) => !coveredInterests.has(i));
      const coverage = addsInterest ? 1 : 0;
      const v = s + spread * 4 + coverage * 5;
      if (!best || v > best.v) best = { c, v };
      const capped = (typeCounts.get(c.typeLabel) ?? 0) >= typeCap;
      if (!capped && (!bestUncapped || v > bestUncapped.v)) {
        bestUncapped = { c, v };
      }
    }
    // Prefer the best uncapped candidate; fall back to the best capped one
    // only when every remaining candidate would breach its type cap, so we
    // still reach the target count instead of returning too few stops.
    const pick = bestUncapped ?? best;
    if (!pick) break;
    chosen.push(pick.c);
    bump(pick.c);
    for (const i of pick.c.interests) coveredInterests.add(i);
  }

  return orderForWalking(chosen, center);
}

// Nearest-neighbour ordering starting from the stop closest to the user's
// entered location, so the route reads as one continuous walk.
function orderForWalking(stops: Candidate[], center: LatLng): Candidate[] {
  if (stops.length <= 2) return stops;
  const remaining = [...stops];
  remaining.sort((a, b) => haversine(a, center) - haversine(b, center));
  const path: Candidate[] = [remaining.shift()!];
  while (remaining.length) {
    const last = path[path.length - 1];
    let bi = 0;
    let bd = Infinity;
    remaining.forEach((c, i) => {
      const d = haversine(last, c);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    path.push(remaining.splice(bi, 1)[0]);
  }
  return path;
}
