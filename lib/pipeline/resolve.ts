// Resolve a /[city]/[slug] request to a tour. Generated tours carry a
// trailing short id in the slug; everything else (and cache misses) falls
// back to the static Echo Park example so links never 404.

import type { Tour, RoutePoint } from "../types";
import { ECHO_PARK_TOUR, ECHO_PARK_ROUTE } from "../data";
import { getById } from "./cache";

export async function resolveTour(
  slug: string
): Promise<{ tour: Tour; route: RoutePoint[] }> {
  const id = slug.split("-").pop() || "";
  if (id && id.length >= 6) {
    const rec = await getById(id);
    if (rec) {
      return { tour: rec.tour, route: rec.tour.route ?? ECHO_PARK_ROUTE };
    }
  }
  return { tour: ECHO_PARK_TOUR, route: ECHO_PARK_ROUTE };
}
