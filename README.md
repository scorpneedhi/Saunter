<!-- DEMO VIDEO: paste the Loom share link below once recorded. This block stays at the very top of the README. -->

> 🎥 **Demo:** _Loom walkthrough — link coming_
>
> _(Replace this line with the Loom embed/link. Human-recorded asset.)_

---

# Saunter

A field guide to any neighborhood, generated on demand.

Saunter turns a place, a duration, and a couple of interests into a real
walking tour: a map, a pedestrian route, 5–10 numbered stops, a short
grounded blurb for each, photos, and a shareable URL. Every stop is a real
place that exists at the stated coordinates, drawn from open data — not
invented by a model.

## How it works

The defining design decision: **the LLM never picks the stops.** Real,
deterministic APIs do. The model only writes the voice, and only from source
text it is handed.

The generation pipeline (`lib/pipeline/generate.ts`):

1. **Geocode** — resolve the free-text location to coordinates via
   **Nominatim** (OSM), with disambiguation toward place/boundary results.
2. **POI fetch** — query the **Overpass API** for OSM points of interest
   matching the chosen interests within a pace-based radius, plus park/water
   polygons for the map backdrop.
3. **Rank & select** — a deterministic scorer (`lib/pipeline/rank.ts`) ranks
   candidates by type weight, interest match, and OSM completeness
   (Wikipedia-tagged places rank higher), then greedily selects 5–10 stops
   with a per-type cap and interest spread, ordered nearest-neighbour into
   one continuous walk.
4. **Route** — compute the pedestrian path through the ordered stops via
   **OSRM** (with a straight-line pace fallback so a tour never hard-fails).
5. **Enrich** — per stop, fetch a **Wikipedia** REST summary and a
   **Wikimedia Commons** lead image where available. This is the *only*
   source material the next step may use.
6. **Voice pass** — the LLM (**Groq, Llama-3.3-70B**) writes the intro,
   outro, and per-stop blurbs, grounded strictly in the retrieved text with
   an explicit no-fabrication instruction. With no API key it degrades to
   grounded, source-trimmed copy so the tour still works.
7. **Cache** — store the tour by content hash of (location, duration, tags)
   so identical requests and shared URLs resolve instantly.

The model cannot fabricate a place, because it never chooses one. Its only
job is sequencing and voice.

## Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript 5.5**
- **Tailwind CSS 3.4** for styling
- **Postgres** via **Neon** (`pg` 8.12) for content-hash tour caching;
  in-memory fallback when no `DATABASE_URL`
- **Groq** (Llama-3.3-70B) for the grounded voice pass
- Open data only: **OpenStreetMap** (Nominatim geocoding, Overpass POIs),
  **OSRM** pedestrian routing, **Wikipedia** REST summaries,
  **Wikimedia Commons** images — no Google APIs, no proprietary map data

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm run start      # serve the production build
npm run lint       # next lint
```

**Environment variables — both optional.** Saunter runs with zero infra:

| Variable         | Effect when set                          | When unset                                    |
| ---------------- | ---------------------------------------- | --------------------------------------------- |
| `DATABASE_URL`   | Tours persist to Postgres (Neon)         | In-memory cache; tours live for the process    |
| `GROQ_API_KEY`   | LLM writes the narration voice           | Grounded, source-trimmed fallback copy         |

With neither set, generation still produces a complete, factually grounded
tour — only the prose voice and cross-restart persistence are degraded.

For deployment (Vercel + Neon), see [`docs/deploy.md`](docs/deploy.md).

## Credits & attribution

Saunter is built entirely on open data and free tiers:

- Map and place data © **OpenStreetMap** contributors, available under the
  [Open Database License](https://www.openstreetmap.org/copyright).
  Geocoding by **Nominatim**, POIs via the **Overpass API**, pedestrian
  routing by the **OSRM** demo server.
- Stop descriptions sourced from **Wikipedia**, text under
  [CC BY-SA](https://creativecommons.org/licenses/by-sa/4.0/).
- Photos from **Wikimedia Commons**, under their respective licenses.

Saunter is not affiliated with any of these projects. Please respect the
fair-use and rate-limit policies of the public OSM/Wikimedia endpoints.
