// Shared HTTP helper for the open-data pipeline.
// Public OSM/Wikipedia services require a descriptive User-Agent and
// dislike being hammered — every call here is timed out and retried once.

import { cacheGet, cacheSet } from "./respcache";

const UA =
  "Saunter/0.1 (+https://saunter.app; walking-tour generator; contact: hello@saunter.app)";

export class PipelineError extends Error {
  constructor(public step: string, message: string) {
    super(message);
    this.name = "PipelineError";
  }
}

interface GetOpts {
  timeoutMs?: number;
  retries?: number;
  accept?: string;
}

export async function getJSON<T>(url: string, opts: GetOpts = {}): Promise<T> {
  const { timeoutMs = 12000, retries = 1, accept = "application/json" } = opts;
  const cached = cacheGet<T>(url);
  if (cached !== undefined) return cached;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { "User-Agent": UA, Accept: accept },
        cache: "no-store",
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      const body = (await res.json()) as T;
      cacheSet(url, body);
      return body;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
      if (attempt < retries) await sleep(600 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function postJSON<T>(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs = 30000
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "User-Agent": UA, ...headers },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// Overpass mirrors tried in order; the .de primary is rate-limited under load
// so we fail over to kumi.systems once exponential backoff is exhausted.
const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const OVERPASS_ATTEMPTS = 3;

async function overpassOnce<T>(
  endpoint: string,
  query: string,
  timeoutMs: number
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      body: "data=" + encodeURIComponent(query),
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// Overpass wants form-encoded `data=`; keep it separate from JSON GETs.
export async function postOverpass<T>(query: string, timeoutMs = 30000): Promise<T> {
  const cached = cacheGet<T>(query);
  if (cached !== undefined) return cached;
  let lastErr: unknown;
  for (const endpoint of OVERPASS_MIRRORS) {
    for (let attempt = 0; attempt < OVERPASS_ATTEMPTS; attempt++) {
      try {
        const body = await overpassOnce<T>(endpoint, query, timeoutMs);
        cacheSet(query, body);
        return body;
      } catch (e) {
        lastErr = e;
        if (attempt < OVERPASS_ATTEMPTS - 1) await sleep(800 * 2 ** attempt);
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
