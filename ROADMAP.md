# Saunter — Roadmap

**Status:** Pipeline complete, pre-launch hardening.
**Target public launch:** May 25, 2026 (PRD §1).
**Last updated:** May 18, 2026.

This roadmap tracks what's left to ship v1 and what follows. It is grounded
in `PRD.md` (sections referenced inline) and the current state of the build.

---

## Done

- Next.js (App Router) + TypeScript + Tailwind scaffold; design tokens in `app/globals.css`.
- Editorial field-guide UI ported pixel-faithfully — landing, generator, loading, tour — verified mobile (390px).
- Typed data layer; presentational components read only from typed data (PRD §8 req. 5).
- Full generation pipeline (PRD §8.2): Nominatim → Overpass (POIs + park/water) → deterministic rank/select → OSRM → Wikipedia/Commons → narration → content-hash cache. The LLM never picks stops.
- Groq Llama-3.3-70B voice pass wired and verified (strict no-fabrication grounding); grounded fallback when no key (PRD §15).
- Postgres (Neon) persistence wired and verified — tours survive restart, shareable by URL.
- `POST /api/generate`, generator wired to real pipeline with honest loading, `/[city]/[slug]` dynamic tour, OG image + metadata.
- Friendly error degradation (sparse area / bad input); clean production build.

---

## Phase 1 — Pre-launch hardening (now → May 21)

Goal: the generated product is good enough for strangers, on the runway in PRD §12.

- [ ] **Ranker diversity.** Dense church/POI-heavy areas skew all stops to one type (observed: Echo Park → 6 places of worship). Cap per-type share; reward interest spread across the selected set. (`lib/pipeline/rank.ts`)
- [ ] **Duration → radius tuning.** Validate 30/60/90/120 produce walks that actually fill the time across ≥10 cities; resolve PRD §15 open question (pace-based radius vs. stop-count packing). Currently distances run long for some areas.
- [ ] **External-call resilience.** Overpass backoff + a second mirror; per-host short-TTL response cache; Nominatim disambiguation when the top hit is wrong (PRD §11: low POI density risk).
- [ ] **Abuse control on `/api/generate`.** Basic IP rate limit + input bounds so a viral spike can't exhaust Groq/Overpass free tiers (PRD §11: cost-spike risk).
- [ ] **Desktop pass.** Layout was built responsively but only verified at 390px; verify/polish the desktop split (map right 55%, list left) per PRD §6.2.

## Phase 2 — Launch readiness (May 21 → May 25)

Maps to PRD §12 days 5–7 and §13.

- [ ] **Deploy.** Vercel (prod) + Neon prod DB; env wired; `maxDuration` validated against generation time.
- [ ] **Seed 20 tours.** Pre-generate and cache diverse cities/tag combos; landing grid reads from real generated tours instead of static `EXAMPLE_TOURS` (PRD §6.3).
- [ ] **Share preview QA.** OG image + tags verified rendering in Twitter/X, iMessage, WhatsApp (PRD §6.2). Title form "A 90-minute walk through {City}." confirmed.
- [ ] **Loom demo + README** with demo at top (PRD §10 "qualified").
- [ ] **Launch assets.** Show HN post (architecture angle), Product Hunt schedule, Twitter thread, TikTok walk video (PRD §13).

## Phase 3 — Post-launch (after May 25)

- [ ] **Real audio narration.** Replace the simulated scrubber with browser `SpeechSynthesis` reading each stop's blurb, synced to active stop + audio bar (PRD §6.2). Currently the only major spec item still mocked.
- [ ] **MapLibre GL JS.** Swap the illustrated SVG paper map for MapLibre + a custom paper-style JSON, OpenFreeMap tiles (PRD §8.1 production target). Keep the SVG look as the visual reference; this is a fidelity-risk migration, sequenced after launch deliberately.
- [ ] **Analytics + observability.** Use Postgres for tour/usage analytics (PRD §8.1); track the §10 launch-week metrics; structured pipeline logging + timing per step.
- [ ] **No-Wikipedia-coverage polish.** Tune the OSM-only fallback blurbs (PRD §15) so coverage-thin neighborhoods still read well.
- [ ] **Latinize non-English place names.** Nominatim returns localized display names for some areas, so tour titles and the landing grid render e.g. "북촌한옥마을 ДЕРЕВНЯ" / "谷中" instead of "Bukchon" / "Yanaka" (observed on the seeded prod tours). Prefer the OSM `name:en` tag, falling back to transliteration, during geocode. Cosmetic only — links/resolution already work (the city slug segment is non-functional; `resolveTour` keys off the trailing id).

## Later — Post-MVP (PRD §14, not committed)

- v1.1 — Server-side TTS via Piper for consistent audio quality.
- v1.2 — User accounts and saved tours.
- v1.3 — User photo upload for stops walked.
- v2.0 — Mobile native app, offline mode, turn-by-turn.
- v2.1 — Tour authoring: edit/regenerate stops, then publish.

---

## Open questions (PRD §15)

- **Radius vs. packing** — defaulting to pace-based radius; revisit in Phase 1 with multi-city data.
- **Cache aggressiveness** — exact-match only (implemented via content hash); near-match collapsing intentionally deferred.
- **No Wikipedia coverage** — handled (OSM-tag fallback narration); quality pass in Phase 3.
