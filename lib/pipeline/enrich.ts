// Step 5 — per stop, fetch a Wikipedia summary (REST API) and a Wikimedia
// Commons lead image where available. This is the *source material* the
// narration step is grounded in; the LLM may not add anything not here.

import { getJSON } from "./http";
import type { Candidate } from "./overpass";

// Extends Candidate, so the retained `osm` facts bundle rides through
// untouched (the `...c` spread below preserves it) for thin-coverage
// narration when there is no Wikipedia extract.
export interface Enriched extends Candidate {
  extract: string; // plain-text Wikipedia summary, "" if none
  photoUrl?: string; // Commons-hosted lead image
  sourceUrl?: string; // Wikipedia article URL
}

interface RestSummary {
  type?: string;
  title?: string;
  extract?: string;
  thumbnail?: { source: string };
  originalimage?: { source: string };
  content_urls?: { desktop?: { page?: string } };
}

async function summaryFor(
  title: string,
  lang: string
): Promise<RestSummary | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title.replace(/ /g, "_")
  )}?redirect=true`;
  try {
    const s = await getJSON<RestSummary>(url, { timeoutMs: 9000, retries: 0 });
    if (s && s.type !== "disambiguation" && s.extract) return s;
    return null;
  } catch {
    return null;
  }
}

export async function enrich(candidates: Candidate[]): Promise<Enriched[]> {
  // Parallel — the slow part of the pipeline; bounded by candidate count.
  return Promise.all(
    candidates.map(async (c): Promise<Enriched> => {
      let lang = "en";
      let title = c.name;
      if (c.wikipedia && c.wikipedia.includes(":")) {
        const [l, ...rest] = c.wikipedia.split(":");
        lang = l;
        title = rest.join(":");
      }

      let s = await summaryFor(title, lang);
      if (!s && lang !== "en") s = await summaryFor(title, "en");
      if (!s) s = await summaryFor(c.name, "en"); // last try by raw name

      return {
        ...c,
        extract: s?.extract ?? "",
        photoUrl: s?.originalimage?.source || s?.thumbnail?.source,
        sourceUrl: s?.content_urls?.desktop?.page,
      };
    })
  );
}
