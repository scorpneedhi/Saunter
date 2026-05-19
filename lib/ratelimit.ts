// In-memory fixed-window limiter. Serverless caveat: state is per-instance and
// best-effort only — acceptable as v1 spike protection to shield free-tier
// Groq/Overpass quotas. The Store seam below lets a shared backend (Redis/pg)
// replace this later WITHOUT touching call sites; do not add one now.

const PER_IP_LIMIT = 5; // requests per IP per window
const GLOBAL_LIMIT = 30; // total requests across all IPs per window (safety ceiling)
const WINDOW_MS = 60_000; // fixed 60s window

interface Window {
  count: number;
  resetAt: number; // epoch ms when this window expires
}

// Single in-process store. A shared backend would implement the same
// get/hit semantics keyed by string.
const store = new Map<string, Window>();
const GLOBAL_KEY = "__global__";

function hit(key: string, limit: number, now: number): { ok: boolean; resetAt: number } {
  const w = store.get(key);
  if (!w || now >= w.resetAt) {
    const fresh: Window = { count: 1, resetAt: now + WINDOW_MS };
    store.set(key, fresh);
    return { ok: true, resetAt: fresh.resetAt };
  }
  w.count += 1;
  return { ok: w.count <= limit, resetAt: w.resetAt };
}

export function checkRateLimit(ip: string): { ok: boolean; retryAfterSec?: number } {
  const now = Date.now();

  // Per-IP first so a single abuser is blamed before the global ceiling trips.
  const perIp = hit(`ip:${ip}`, PER_IP_LIMIT, now);
  if (!perIp.ok) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((perIp.resetAt - now) / 1000)) };
  }

  const global = hit(GLOBAL_KEY, GLOBAL_LIMIT, now);
  if (!global.ok) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((global.resetAt - now) / 1000)) };
  }

  return { ok: true };
}
