// Step 7 — cache generated tours by content hash so identical inputs return
// instantly and a shared URL always resolves (PRD §8.2 / §15 exact-match).
//
// Postgres (Neon) when DATABASE_URL is set; otherwise a process-global
// in-memory map so the app runs with zero infra. Any DB error degrades to
// memory rather than failing generation.

import type { Tour } from "../types";

export interface TourRecord {
  id: string;
  hash: string;
  tour: Tour;
}

type MemStore = { byId: Map<string, TourRecord>; byHash: Map<string, TourRecord> };

const g = globalThis as unknown as {
  __saunterMem?: MemStore;
  __saunterPg?: { pool: unknown; ready: Promise<boolean> } | null;
};

function mem(): MemStore {
  if (!g.__saunterMem) {
    g.__saunterMem = { byId: new Map(), byHash: new Map() };
  }
  return g.__saunterMem;
}

async function pg(): Promise<{
  query: (q: string, p?: unknown[]) => Promise<{ rows: any[] }>;
} | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    if (!g.__saunterPg) {
      // Dynamic import so a missing `pg` / no DATABASE_URL never breaks build.
      // `pg` is CommonJS: under a bundler the named export resolves, but under
      // raw node/tsx (e.g. the seed script) only `default.Pool` exists, so the
      // named binding would be undefined and `new Pool()` would throw.
      const pgModule = await import("pg");
      const Pool = pgModule.Pool ?? (pgModule.default as typeof pgModule).Pool;
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        max: 3,
        ssl: process.env.DATABASE_URL.includes("localhost")
          ? undefined
          : { rejectUnauthorized: false },
      });
      const ready = pool
        .query(
          `CREATE TABLE IF NOT EXISTS tours (
             id text PRIMARY KEY,
             hash text UNIQUE NOT NULL,
             payload jsonb NOT NULL,
             created_at timestamptz NOT NULL DEFAULT now()
           );
           CREATE TABLE IF NOT EXISTS tour_events (
             id bigserial PRIMARY KEY,
             type text NOT NULL,
             city_slug text,
             slug text,
             ms integer,
             narrated boolean,
             error text,
             ip_hash text,
             created_at timestamptz NOT NULL DEFAULT now()
           )`
        )
        .then(() => true)
        .catch(() => false);
      g.__saunterPg = { pool, ready };
    }
    const ok = await g.__saunterPg.ready;
    if (!ok) return null;
    const pool = g.__saunterPg.pool as {
      query: (q: string, p?: unknown[]) => Promise<{ rows: any[] }>;
    };
    return pool;
  } catch {
    g.__saunterPg = null;
    return null;
  }
}

export async function getById(id: string): Promise<TourRecord | null> {
  const m = mem().byId.get(id);
  if (m) return m;
  const db = await pg();
  if (!db) return null;
  try {
    const { rows } = await db.query("SELECT id, hash, payload FROM tours WHERE id = $1", [id]);
    if (!rows.length) return null;
    const rec: TourRecord = { id: rows[0].id, hash: rows[0].hash, tour: rows[0].payload };
    mem().byId.set(rec.id, rec);
    mem().byHash.set(rec.hash, rec);
    return rec;
  } catch {
    return null;
  }
}

export async function getByHash(hash: string): Promise<TourRecord | null> {
  const m = mem().byHash.get(hash);
  if (m) return m;
  const db = await pg();
  if (!db) return null;
  try {
    const { rows } = await db.query(
      "SELECT id, hash, payload FROM tours WHERE hash = $1",
      [hash]
    );
    if (!rows.length) return null;
    const rec: TourRecord = { id: rows[0].id, hash: rows[0].hash, tour: rows[0].payload };
    mem().byId.set(rec.id, rec);
    mem().byHash.set(rec.hash, rec);
    return rec;
  } catch {
    return null;
  }
}

export async function listTours(limit = 9): Promise<Tour[]> {
  const db = await pg();
  if (!db) {
    return Array.from(mem().byId.values())
      .map((r) => r.tour)
      .slice(0, limit);
  }
  try {
    const { rows } = await db.query(
      "SELECT payload FROM tours ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    return rows.map((r) => r.payload as Tour);
  } catch {
    return [];
  }
}

export interface TourEvent {
  type: "generate_request" | "generate_success" | "generate_error" | "tour_view";
  citySlug?: string;
  slug?: string;
  ms?: number;
  narrated?: boolean;
  error?: string;
  ipHash?: string;
}

// Best-effort analytics persistence. Mirrors save()'s degrade pattern
// exactly: if DATABASE_URL is unset pg() returns null and this is a pure
// no-op; if the pool or INSERT throws we swallow it. Generation and page
// renders must NEVER fail because an event could not be recorded.
export async function logEvent(e: TourEvent): Promise<void> {
  let db: Awaited<ReturnType<typeof pg>> = null;
  try {
    db = await pg();
  } catch {
    return; // pg() already degrades, but guard the await defensively too
  }
  if (!db) return; // no DATABASE_URL, or table bootstrap failed
  try {
    await db.query(
      `INSERT INTO tour_events (type, city_slug, slug, ms, narrated, error, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        e.type,
        e.citySlug ?? null,
        e.slug ?? null,
        e.ms ?? null,
        e.narrated ?? null,
        e.error ?? null,
        e.ipHash ?? null,
      ]
    );
  } catch {
    /* analytics is best-effort; a write failure must never surface */
  }
}

// Aggregations for the PRD §10 launch-week scorecard. Documented SQL lives in
// docs/metrics.sql; this helper exposes the same numbers to an internal
// dashboard/route without shipping raw SQL into app code. Degrades to an
// empty result with DATABASE_URL unset (events live only in Postgres).
export interface MetricsSummary {
  generateRequests: number;
  generateSuccess: number;
  generateError: number;
  errorRate: number; // generate_error / generate_request, 0 when no requests
  uniqueVisitors: number; // distinct ip_hash on tour_view
  tourViews: number;
  toursShared: number; // proxy: distinct slugs viewed from >1 distinct ip_hash
  p50Ms: number | null;
  p95Ms: number | null;
}

export async function metricsSummary(
  sinceHours = 24 * 7
): Promise<MetricsSummary> {
  const empty: MetricsSummary = {
    generateRequests: 0,
    generateSuccess: 0,
    generateError: 0,
    errorRate: 0,
    uniqueVisitors: 0,
    tourViews: 0,
    toursShared: 0,
    p50Ms: null,
    p95Ms: null,
  };
  const db = await pg();
  if (!db) return empty;
  try {
    const { rows } = await db.query(
      `WITH win AS (
         SELECT * FROM tour_events
         WHERE created_at >= now() - ($1 || ' hours')::interval
       )
       SELECT
         (SELECT count(*) FROM win WHERE type = 'generate_request')        AS gen_req,
         (SELECT count(*) FROM win WHERE type = 'generate_success')        AS gen_ok,
         (SELECT count(*) FROM win WHERE type = 'generate_error')          AS gen_err,
         (SELECT count(DISTINCT ip_hash) FROM win
            WHERE type = 'tour_view' AND ip_hash IS NOT NULL)              AS uniq_vis,
         (SELECT count(*) FROM win WHERE type = 'tour_view')               AS views,
         (SELECT count(*) FROM (
            SELECT slug FROM win
            WHERE type = 'tour_view' AND slug IS NOT NULL AND ip_hash IS NOT NULL
            GROUP BY slug HAVING count(DISTINCT ip_hash) > 1
          ) s)                                                            AS shared,
         (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY ms)
            FROM win WHERE type = 'generate_success' AND ms IS NOT NULL)   AS p50,
         (SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY ms)
            FROM win WHERE type = 'generate_success' AND ms IS NOT NULL)   AS p95`,
      [String(sinceHours)]
    );
    const r = rows[0] ?? {};
    const genReq = Number(r.gen_req ?? 0);
    const genErr = Number(r.gen_err ?? 0);
    return {
      generateRequests: genReq,
      generateSuccess: Number(r.gen_ok ?? 0),
      generateError: genErr,
      errorRate: genReq > 0 ? genErr / genReq : 0,
      uniqueVisitors: Number(r.uniq_vis ?? 0),
      tourViews: Number(r.views ?? 0),
      toursShared: Number(r.shared ?? 0),
      p50Ms: r.p50 == null ? null : Math.round(Number(r.p50)),
      p95Ms: r.p95 == null ? null : Math.round(Number(r.p95)),
    };
  } catch {
    return empty;
  }
}

export async function save(rec: TourRecord): Promise<void> {
  mem().byId.set(rec.id, rec);
  mem().byHash.set(rec.hash, rec);
  const db = await pg();
  if (!db) return;
  try {
    await db.query(
      `INSERT INTO tours (id, hash, payload) VALUES ($1, $2, $3)
       ON CONFLICT (hash) DO NOTHING`,
      [rec.id, rec.hash, JSON.stringify(rec.tour)]
    );
  } catch {
    /* memory already holds it; DB persistence is best-effort */
  }
}
