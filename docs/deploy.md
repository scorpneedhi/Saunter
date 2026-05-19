# Deploying Saunter

A precise runbook to deploy Saunter to production on Vercel + Neon. Follow the steps in order.

## 1. Create the Vercel project

1. Push this repo to GitHub (or your Git host).
2. In the Vercel dashboard: **Add New → Project**, import this repository.
3. Framework preset: **Next.js** (auto-detected). Leave build/output settings at defaults.
4. Do **not** deploy yet — set the environment variables first (step 3).

## 2. Create the Neon production database

1. In the [Neon console](https://console.neon.tech): **New Project**, pick a region close to your Vercel region.
2. Create/keep the default database.
3. Copy the **pooled** connection string (looks like `postgresql://USER:PASSWORD@HOST/DB?sslmode=require`). You will use it as `DATABASE_URL`.

No schema setup is needed here — see the note at the bottom.

## 3. Set environment variables in Vercel

In **Project → Settings → Environment Variables**, add the **two** core variables (Production scope, also Preview if you want previews to persist):

| Variable | Value | Effect if missing |
| --- | --- | --- |
| `DATABASE_URL` | Neon pooled connection string from step 2 | App degrades to an in-memory `Map`; tours do **not** persist across requests/instances. Read in `lib/pipeline/cache.ts:33`. |
| `GROQ_API_KEY` | Your Groq API key | Narration falls back to grounded Wikipedia copy (still functional, less rich). Read in `lib/pipeline/narrate.ts:79`. |

Nominatim, Overpass, OSRM, Wikipedia, and Wikimedia Commons are all public services that require **no API keys**.

### Optional: map kill-switch

| Variable | Value | Effect |
| --- | --- | --- |
| `NEXT_PUBLIC_USE_MAPLIBRE` | unset (default) | MapLibre GL JS (OpenFreeMap tiles) for tours with real coordinates; SVG paper map auto-fallback for coordinate-less tours. |
| `NEXT_PUBLIC_USE_MAPLIBRE` | `0` | **Kill-switch:** forces the SVG paper map everywhere. Read in `components/Tour.tsx`. |

**Rollback (map):** if the MapLibre/OpenFreeMap path misbehaves in production
(tile host down, fidelity regression), set `NEXT_PUBLIC_USE_MAPLIBRE=0` and
redeploy/restart — no code change. Permanent rollback is a one-line revert of
the `MapComponent` selector in `components/Tour.tsx`. The SVG `PaperMap` and the
Open Graph share image are unaffected either way.

## 4. Build and deploy

1. Locally, confirm a clean build: `npm run build`.
2. Trigger the Vercel deployment (push to the connected branch, or **Deploy** in the dashboard). Vercel runs `npm run build` and deploys.

## 5. Post-deploy smoke check

1. Open the deployed site and generate **one real tour** (a real city, default interests/duration).
2. Confirm it completes successfully and returns a tour within the **120s** `maxDuration` configured on `app/api/generate/route.ts`. Cold worst case is ~45-50s (Groq narration 35s timeout + Overpass exponential backoff), so a healthy run finishes well under the limit.
3. If `DATABASE_URL` is set, regenerate the same request and confirm it is served from cache (fast, persisted).

## Note: database schema

There is **no migration step**. The schema is created automatically on first use via `CREATE TABLE IF NOT EXISTS` in `lib/pipeline/cache.ts`. Just provide a valid empty Neon database via `DATABASE_URL`.
