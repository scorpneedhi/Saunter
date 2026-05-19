# Saunter — Product Requirements Document

**Status:** Draft v1
**Last updated:** May 18, 2026
**Target public launch:** May 25, 2026 (T+7 days)

---

## 1. Summary

Saunter generates personalized, narrated walking tours for any neighborhood in the world, grounded in 100% open data. The user enters a starting location, how much time they have, and what they're interested in. In under a minute, they get a shareable web page containing a real map with a walking route, 5–10 numbered stops, a short evocative blurb for each, photos, and an audio narration that plays while they walk.

The product exists at the intersection of three things that have recently become possible at low cost: rich open geographic data (OpenStreetMap), free encyclopedic context (Wikipedia), and capable open-weight language models served at high speed on free tiers.

## 2. Problem

People who travel, host visitors, or want to better understand the neighborhood they already live in have two bad options today:

1. **Generic, paid tour platforms** (GetYourGuide, Viator) sell scheduled group tours at scale. They are expensive, inflexible on timing, and serve only the most touristy parts of major cities.
2. **AI-generated itineraries from chatbots** are free and instant but routinely hallucinate places, get walking distances wrong, and lack maps, photos, or audio.

Neither option serves a person who has 90 minutes free this afternoon and wants to learn something about the few blocks around them.

## 3. Target user

Three concrete personas, in priority order:

1. **The curious local** — lives in a city, has spent years walking past the same buildings, wants to understand what they're looking at. Highest LTV, highest sharing potential.
2. **The independent traveler** — in a new city for 2–4 days, doesn't want a group tour, wants to spend a free afternoon exploring on their own terms.
3. **The local host** — friend or family visiting; wants to send them a self-guided tour for the morning while they're at work.

All three share one trait: they want to walk, learn, and be alone (or with one or two people), not stand in a group of 20 behind someone with a flag.

## 4. Goals and non-goals

### Goals (v1)

- Produce factually grounded tours — every stop must correspond to a real place that exists at the stated coordinates.
- Generate a tour in under 60 seconds from request to first paint.
- Make each tour a single shareable URL that previews beautifully when pasted into Twitter, iMessage, or WhatsApp.
- Operate at $0 marginal cost per tour at expected launch volume.

### Non-goals (explicitly)

- Not a booking platform. Saunter does not transact, reserve, or recommend purchases.
- Not a turn-by-turn navigation app. The map shows the route; the user's own map app handles directions if needed.
- Not multi-day or multi-city itineraries. One walk, one place, one session.
- Not user accounts, saved favorites, or social features in v1.
- Not a mobile native app in v1. Mobile web only.

## 5. Key user journey

A user lands on `saunter.app` and sees a grid of pre-generated tours for famous neighborhoods worldwide. They click "make your own," type "Echo Park, Los Angeles," select "90 minutes" and "architecture, public art." After ~45 seconds, they land on a tour page with a map, an ordered list of 7 stops, a hero photo, and a play button. They tap play and start walking. When they're done, they share the URL with a friend who lives in the neighborhood.

## 6. Functional requirements (MVP)

### 6.1 Tour generation

- Accept input: starting location (geocoded string or browser geolocation), duration (30 / 60 / 90 / 120 min), 1–3 interest tags from a fixed set.
- Interest tags for v1: *history, architecture, public art, hidden gems, food and drink, nature.*
- Query OpenStreetMap for points of interest matching tags within walking radius implied by duration.
- Score and select 5–10 stops based on POI density, walking distance, and tag relevance.
- Compute a pedestrian route through stops.
- For each stop, retrieve Wikipedia/Wikidata content and a Wikimedia Commons photo where available.
- Generate per-stop narration and tour-level intro/outro via LLM, grounded in retrieved content.

### 6.2 Tour page

- Interactive map with numbered stops and the walking route drawn between them.
- Ordered list of stops, each expandable, with photo, blurb, and a "now playing" indicator during audio playback.
- A single play/pause control for the full audio narration. Audio synthesizes on-demand using browser SpeechSynthesis API in v1.
- Shareable canonical URL: `saunter.app/{city-slug}/{tour-slug}-{shortid}`.
- Open Graph metadata pre-rendered server-side with map static image as preview.

### 6.3 Pre-generated seed tours

- 20 hand-curated tours generated and cached before launch, displayed on the landing page.
- Cover diverse cities and tag combinations to demonstrate range.

## 7. Out of scope for v1

User accounts, login, saved tours, favorites, edit/regenerate, multi-language support, indoor venues, restaurant reservations, transit routing, offline mode, native apps, social comments, ratings, tour creator profiles, monetization, custom voice selection for narration, multiple languages, accessibility audit beyond keyboard/screen-reader basics.

## 8. Architecture and data flow

### 8.1 Stack

- **Frontend:** Next.js (App Router), TypeScript, Tailwind, shadcn/ui, MapLibre GL JS.
- **Tile provider:** OpenFreeMap (vector tiles, no API key).
- **Hosting:** Vercel free tier.
- **Database:** Postgres on Neon free tier. Used for caching generated tours by content hash and for analytics.
- **LLM:** Llama 3.3 70B via Groq free tier. Streaming responses for tour narration.
- **TTS:** Browser SpeechSynthesis API. No server-side audio generation in v1.

### 8.2 The key architectural decision

**The AI does not pick the stops. Real APIs do.** This is the single most important design choice and the most important thing to document.

The generation pipeline is:

1. Geocode input → coordinates (Nominatim).
2. Query Overpass API for OSM POIs matching the user's tags within a radius computed from duration.
3. Score and rank candidate stops by tag match, OSM completeness (places with Wikipedia tags rank higher), and spatial distribution.
4. Select 5–10 stops and compute walking route via OSRM.
5. For each stop, fetch Wikipedia summary (REST API) and a Wikimedia Commons image where available.
6. Bundle the structured data (name, type, coordinates, Wikipedia excerpt) and send to the LLM with a strict prompt: write a 60–90 word blurb for each stop using only the provided source material; do not invent facts.
7. Cache the generated tour by hash of (location, duration, tags) so repeated requests return instantly.

The LLM's only job is voice and sequencing. It cannot fabricate places, because it never chooses them.

### 8.3 Data flow diagram (textual)

```
User input
    ↓
Nominatim (geocoding)
    ↓
Overpass API (POI candidates)
    ↓
Ranking + selection (in-process)
    ↓
OSRM (walking route)
    ↓
Wikipedia REST API + Wikimedia Commons (per stop)
    ↓
LLM via Groq (narration generation, grounded in retrieved content)
    ↓
Postgres (cache write)
    ↓
Tour page (rendered)
```

## 9. UX principles

- **Calm, not busy.** White space, generous typography, one primary action per screen.
- **Map is the hero.** On the tour page, the map is the largest element; the list complements it rather than competing with it.
- **No skeletons that lie.** Loading states show what the system is actually doing ("finding interesting places nearby…", "writing your tour…") because the generation takes 30–60 seconds and the user deserves to know why.
- **Mobile-first, always.** Users will open tours on their phone while walking. Every layout is designed for one-handed use at arm's length.

Reference aesthetic: Linear's typography, Are.na's restraint, Apple Maps' calm map styling.

## 10. Success metrics

### Launch week (T+0 to T+7)

- 1,000 unique visitors to the landing page.
- 200 tours generated by non-team users.
- 20 tours shared publicly (URL pasted somewhere observable).
- A Product Hunt or Hacker News appearance, ideally both.
- 50 Twitter/X mentions or replies.

### What "qualified" looks like for portfolio purposes

- Live, working product with public users (any number > 0 with a real tour they generated).
- A README with a Loom demo at the top.
- A short post-mortem blog post about the build and what was learned.
- At least one screenshot of organic external use (a tweet, a Reddit comment, a real shared tour URL).

## 11. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| OSM POI density is too low in some areas | High in suburbs, low in dense cities | Gate launch cities to dense urban areas; show clear error if too few candidates found |
| LLM hallucinates despite grounding | Medium | Strict prompt: "use only the provided text"; manual review of first 50 generated tours |
| Browser TTS quality varies wildly across devices | High | Accept this for v1; add note explaining; plan Piper-based server TTS for v2 |
| Generation takes too long (>60s) | Medium | Parallelize Wikipedia fetches; stream LLM output; show progress narration |
| Costs spike if a tour goes viral | Low at free tiers | Cache aggressively; Groq free tier rate-limits before billing kicks in |
| Distribution flop (post gets no traction) | Medium | Multiple channels primed in advance; pre-generated tours mean the landing page works even without user-generated content |

## 12. Timeline

| Day | Focus |
|---|---|
| 1 (Mon) | Scope lock, repo setup, Next.js scaffold, Nominatim + Overpass integration spike |
| 2 (Tue) | POI scoring + selection, OSRM routing, end-to-end backend wired (no UI) |
| 3 (Wed) | Wikipedia/Commons fetch, LLM prompt iteration, full generation pipeline working |
| 4 (Thu) | Tour page UI: map, list, audio control. Mobile-first layout. |
| 5 (Fri) | Landing page, pre-generate 20 seed tours, OG image pipeline, deploy to production |
| 6 (Sat) | Polish: empty/error states, loading copy, share preview testing, Loom demo recording |
| 7 (Sun) | Launch: Product Hunt schedule, HN Show post, Twitter thread, relevant subreddits |

## 13. Launch plan

- **Product Hunt:** Schedule launch for Tuesday after the build week. Hunter outreach in advance.
- **Hacker News:** Show HN post on launch day, manually submitted, focused on the architectural angle ("100% open data, no Google APIs").
- **Twitter/X:** Thread with screen recordings of the landing page and a real tour, plus the architecture insight.
- **Reddit:** r/travel, r/solotravel, r/[specific cities for pre-generated tours] — only with genuine engagement, not drops.
- **TikTok:** One 30-second video of actually walking a generated tour, filmed before launch.

## 14. Post-MVP roadmap (not committed)

- v1.1: Server-side TTS via Piper for consistent audio quality.
- v1.2: User accounts and saved tours.
- v1.3: Photo upload — users add their own photos to tour stops they've walked.
- v2.0: Mobile native app with offline mode and turn-by-turn.
- v2.1: Tour authoring — power users can edit/regenerate stops, then publish.

## 15. Open questions

- Should duration map to a fixed walking-pace radius, or should the system pack stops to fill the time more loosely? (Defaulting to: pace-based radius with stop count tuned by density.)
- How aggressive should the cache be? Identical inputs returning identical tours feels right; near-identical inputs returning the same tour might feel like a bug. (Defaulting to: exact-match cache only.)
- What happens when a user generates a tour for a location with no Wikipedia coverage at all? (Defaulting to: still produce the tour, narration is based purely on OSM tags and is shorter / more descriptive.)
