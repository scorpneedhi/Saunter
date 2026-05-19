# Saunter — Launch Assets

Draft copy for launch day. The **Loom demo recording** and the
**TikTok walk video** are human-produced assets — the sections below are
only the scripts/copy to record against, not the assets themselves.

The throughline across every channel is the honest architectural angle:
**the LLM never picks the stops.** Saunter is a deterministic
OpenStreetMap + Wikipedia pipeline; the model only does a grounded voice
pass and cannot fabricate a place because it never chooses one.

---

## Show HN

**Title:**

```
Show HN: Saunter – walking tours where the LLM never picks the stops
```

**Body:**

Saunter generates a literary walking tour for any neighborhood: a map, a
pedestrian route, 5–10 stops, a short grounded blurb each, photos, and a
shareable URL.

The thing I wanted to get right is that chatbot itineraries hallucinate
places and get distances wrong. So in Saunter the model has no say in
*what* you visit. The pipeline is deterministic:

1. Nominatim geocodes the location.
2. Overpass returns real OSM POIs matching your interests within a
   pace-based radius.
3. A deterministic scorer ranks and selects 5–10 stops (type weight,
   interest match, Wikipedia-tagged completeness, a per-type cap, and
   nearest-neighbour ordering).
4. OSRM computes the pedestrian route.
5. Wikipedia REST + Wikimedia Commons supply per-stop text and images.
6. Only now does an LLM (Llama-3.3-70B on Groq) run — it writes the intro,
   outro, and blurbs, grounded strictly in that retrieved text with a
   no-fabrication instruction. With no API key it falls back to grounded,
   source-trimmed copy.
7. Tours are cached by content hash, so shared URLs are stable.

The model cannot invent a place because it never chooses one. Its only job
is sequencing and voice.

100% open data — OpenStreetMap, OSRM, Wikipedia, Wikimedia Commons — no
Google APIs. Next.js, Postgres on Neon, all on free tiers. It runs with
zero infra (in-memory cache + grounded fallback when no DB/LLM key).

Built solo in a week. Would genuinely like feedback on the ranking
heuristic and on grounding failure modes. Try your own block:

[saunter.app]

---

## Twitter / X thread

> 5 tweets, one CTA in the last. Keep each under ~270 chars.

**1/**
Most AI itineraries hallucinate places and get walking distances wrong.

So I built Saunter, where the LLM is forbidden from choosing where you go.

It generates a real walking tour for any neighborhood: map, route, stops,
photos, a shareable link. 🧵

**2/**
The core decision: the LLM never picks the stops. Real APIs do.

Nominatim geocodes → Overpass pulls actual OpenStreetMap POIs matching your
interests within a pace-based radius. Nothing is invented; everything has
coordinates.

**3/**
A deterministic ranker selects 5–10 stops: type weight, interest match,
Wikipedia-tagged completeness, a per-type cap so you don't get six churches,
nearest-neighbour ordering. Then OSRM draws the pedestrian route.

**4/**
Only *then* does an LLM run. It's handed each stop's Wikipedia text and told
to write the voice — intro, outro, blurbs — and invent nothing. No key? It
falls back to grounded, trimmed source copy. The walk still works.

**5/**
100% open data: OpenStreetMap, OSRM, Wikipedia, Wikimedia Commons. No
Google APIs. Runs on free tiers with zero infra.

Generate a tour of your own neighborhood: [saunter.app]

---

## Product Hunt

**Tagline** (<60 chars):

```
Walking tours where the AI never picks the stops
```

**Description** (~260 chars):

```
Saunter turns any neighborhood into a literary walking tour — map, route,
5–10 real stops, photos, a shareable link. It's a deterministic
OpenStreetMap + Wikipedia pipeline; an LLM only writes the voice, grounded
in real sources. No Google APIs, all open data.
```

**Maker comment bullets:**

- **The hook is a constraint.** Chatbot itineraries hallucinate. Saunter's
  model literally cannot — it never chooses a place, it only narrates ones
  the OSM/Overpass pipeline already selected and Wikipedia already described.
- **100% open data.** OpenStreetMap, Overpass, OSRM, Wikipedia, Wikimedia
  Commons. No Google Maps, no proprietary place data, no per-request cost.
- **Runs with zero infra.** No database key → in-memory cache. No LLM key →
  grounded fallback prose. The tour is always factually complete.
- **Built solo in a week.** Next.js + Postgres on Neon, free tiers
  throughout. Feedback on the ranking heuristic especially welcome.

---

## TikTok walk video

> Concept only. The actual 20–30s video is a **human-recorded asset** —
> filmed on a phone on a real walk. This is the shot list / script outline.

**Concept:** generate a tour, then actually walk the first stop. Show that
the place on the screen is the place in front of the camera.

| Time   | Shot                                                                 | Caption / VO                                     |
| ------ | -------------------------------------------------------------------- | ------------------------------------------------ |
| 0–4s   | Phone screen: type a neighborhood, tap 90 min + "history, art"       | "Any neighborhood. 90 minutes."                  |
| 4–8s   | Loading copy ticking through, then the tour page resolves with map   | "It's not making this up."                       |
| 8–14s  | Finger traces the route + numbered stops on the map                  | "Real OSM places. The AI only writes the voice." |
| 14–24s | Cut to walking outside — phone held up to Stop 1, screen matches it  | (ambient) blurb text shown on screen             |
| 24–30s | Pocket the phone, keep walking, end card with URL                    | "saunter.app — make your own walk."              |

**Notes for the human recording it:**

- Pick a visibly photogenic first stop so the screen-vs-reality match lands.
- Keep it quiet and unhurried — the product's tone is calm/editorial, not
  hype. No fast cuts, no trending-audio shouting.
- Vertical, shot on a phone, daylight. Authenticity beats polish here.
