import { NextResponse } from "next/server";
import { generateTour } from "@/lib/pipeline/generate";
import { PipelineError } from "@/lib/pipeline/http";
import type { Interest } from "@/lib/pipeline/overpass";
import { checkRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const VALID: Interest[] = [
  "history",
  "architecture",
  "public art",
  "hidden gems",
  "food and drink",
  "nature",
];

export async function POST(req: Request) {
  // Rate-limit BEFORE parsing so abusive bursts can't even reach the pipeline.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown";
  const rl = checkRateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You're generating walks too fast. Give it a minute." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: { location?: string; duration?: number; tags?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const location = (body.location || "").trim();
  const duration = Number(body.duration);
  const tags = (body.tags || []).filter((t): t is Interest =>
    VALID.includes(t as Interest)
  );

  if (!location) {
    return NextResponse.json({ error: "Tell us where to walk." }, { status: 400 });
  }
  // Bound input to keep downstream geocode/Overpass payloads sane.
  if (location.length > 120) {
    return NextResponse.json(
      { error: "That location is too long." },
      { status: 400 }
    );
  }
  if (![30, 60, 90, 120].includes(duration)) {
    return NextResponse.json({ error: "Pick a duration." }, { status: 400 });
  }
  if (tags.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one thing to look for." },
      { status: 400 }
    );
  }

  try {
    const out = await generateTour({ location, duration, tags });
    return NextResponse.json(out);
  } catch (e) {
    if (e instanceof PipelineError) {
      return NextResponse.json({ error: e.message }, { status: 422 });
    }
    console.error("generate failed:", e);
    return NextResponse.json(
      { error: "Something went wrong building your walk. Try again." },
      { status: 500 }
    );
  }
}
