// Step 6 — narration. The LLM's only job is voice and sequencing; it is given
// the retrieved source text and told to use nothing else (PRD §8.2).
// With no GROQ_API_KEY it degrades to grounded, source-trimmed copy so the
// tour still works (PRD §15 fallback).

import { postJSON } from "./http";
import type { Enriched } from "./enrich";
import type { PhotoTone } from "../types";

export interface Narration {
  intro: string;
  outro: string;
  blurbs: string[]; // aligned to the input order
  narrated: boolean; // true if the LLM voice pass ran
}

const TONE_BY_LABEL: Record<string, PhotoTone> = {
  "Place of worship": "warm-grey",
  Museum: "warm-grey",
  Building: "warm-grey",
  "Public art": "brick",
  "Historic site": "cream",
  Park: "sage",
  Water: "sage",
  Viewpoint: "sage",
  Café: "cream",
  Bar: "brick",
  Restaurant: "brick",
};

export function toneFor(typeLabel: string): PhotoTone {
  return TONE_BY_LABEL[typeLabel] ?? "warm-grey";
}

function trimWords(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const words = clean.split(" ");
  if (words.length <= max) return clean;
  let out = words.slice(0, max).join(" ");
  const lastDot = out.lastIndexOf(". ");
  if (lastDot > 40) out = out.slice(0, lastDot + 1);
  else out = out.replace(/[,;:]?\s*\S*$/, "") + "…";
  return out;
}

function fallbackBlurb(e: Enriched, city: string): string {
  if (e.extract) return trimWords(e.extract, 85);
  const a = /^[aeiou]/i.test(e.typeLabel) ? "An" : "A";
  return `${a} ${e.typeLabel.toLowerCase()} in ${city}, marked on the map from OpenStreetMap. There is no Wikipedia article for it yet, so this stop is here for what it is rather than what's been written about it — look up, look around, and read the building itself.`;
}

function fallbackNarration(
  stops: Enriched[],
  city: string,
  region: string,
  tags: string[]
): Narration {
  return {
    intro: `A walk through ${city}, ${region}, following ${stops.length} places drawn from open map data and what Wikipedia knows about them. The thread is ${tags.join(
      " and "
    )}; the pace is yours.`,
    outro: `That's the walk. ${stops[stops.length - 1]?.name} is the last stop — stay as long as it holds you, then find your own way back.`,
    blurbs: stops.map((s) => fallbackBlurb(s, city)),
    narrated: false,
  };
}

interface GroqResp {
  choices: { message: { content: string } }[];
}

export async function narrate(
  stops: Enriched[],
  city: string,
  region: string,
  tags: string[],
  durationMin: number
): Promise<Narration> {
  const key = process.env.GROQ_API_KEY;
  if (!key) return fallbackNarration(stops, city, region, tags);

  const sources = stops
    .map(
      (s, i) =>
        `STOP ${i + 1}: ${s.name} (${s.typeLabel})\nSOURCE: ${
          s.extract ? s.extract.slice(0, 900) : "[no Wikipedia article; OSM tags only]"
        }`
    )
    .join("\n\n");

  const system =
    "You are a literary travel writer in the register of Monocle or Cereal magazine: " +
    "observational, dry, precise, never breathless. You write walking-tour narration " +
    "GROUNDED STRICTLY in the provided SOURCE text. Do not invent facts, dates, names, " +
    "or anecdotes. If a stop has no source, write a short, honest, descriptive note and " +
    "do not fabricate history. Return ONLY valid JSON.";

  const user =
    `City: ${city}, ${region}. Interests: ${tags.join(", ")}. Duration: ${durationMin} min.\n\n` +
    `${sources}\n\n` +
    `Return JSON: {"intro": string (~55 words, second person, sets the walk up), ` +
    `"outro": string (~40 words, lands the walk at the final stop), ` +
    `"blurbs": string[] (one per stop in order, 60-90 words each, evocative but ` +
    `strictly grounded in that stop's SOURCE)}. No markdown, no extra keys.`;

  try {
    const data = await postJSON<GroqResp>(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        temperature: 0.6,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      },
      { Authorization: `Bearer ${key}` },
      35000
    );
    const parsed = JSON.parse(data.choices[0].message.content) as {
      intro: string;
      outro: string;
      blurbs: string[];
    };
    if (
      !parsed.intro ||
      !parsed.outro ||
      !Array.isArray(parsed.blurbs) ||
      parsed.blurbs.length !== stops.length
    ) {
      throw new Error("LLM returned malformed narration");
    }
    return { ...parsed, narrated: true };
  } catch {
    // Any LLM failure → grounded fallback rather than a broken tour.
    return fallbackNarration(stops, city, region, tags);
  }
}
