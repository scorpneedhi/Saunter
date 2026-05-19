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
      const { Pool } = await import("pg");
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
