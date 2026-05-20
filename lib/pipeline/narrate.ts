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

function aOrAn(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

// Strip a trailing period and lower the first letter so a value can be
// folded mid-sentence without reading like a label.
function cleanFragment(s: string): string {
  return s.replace(/\s+/g, " ").trim().replace(/[.;]+$/, "");
}

function tidyDescription(s: string): string {
  const c = cleanFragment(s);
  if (!c) return "";
  const withCap = c.charAt(0).toUpperCase() + c.slice(1);
  return /[.!?]$/.test(withCap) ? withCap : `${withCap}.`;
}

// Pull a 4-digit year out of start_date ("1924", "1924-06", "c. 1924")
// or, failing that, out of any retained tag value. Never invents one.
function yearFrom(osm: NonNullable<Enriched["osm"]>): string | undefined {
  const direct = osm.start_date?.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
  if (direct) return direct[1];
  for (const v of Object.values(osm)) {
    const m = typeof v === "string" && v.match(/\b(1[0-9]{3}|20[0-2][0-9])\b/);
    if (m) return m[1];
  }
  return undefined;
}

// A small rotating set of closers keyed off the type label so that six
// bare churches in a row don't all end on the identical sentence. Indexed
// deterministically by name so a given stop is stable across renders.
function bareCloser(typeLabel: string, name: string): string {
  const t = typeLabel.toLowerCase();
  const variants = [
    `The map flags it; the rest is what you make of standing in front of ${aOrAn(
      t
    )} ${t} and actually looking.`,
    `No article has caught up with it, so it stands here as itself — read the ${t} rather than a caption.`,
    `Open map data places it; there is no written history to lean on, only the ${t} in front of you.`,
    `It earns its place by being here, not by being written about — give the ${t} a slow look.`,
    `Wikipedia is silent on it, which leaves the ${t} to speak for itself if you let it.`,
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return variants[Math.abs(h) % variants.length];
}

// Compose a varied, fact-grounded note for stops with no Wikipedia extract.
// Branches on which OSM tags exist and varies sentence shape so consecutive
// thin stops never read identically. Never asserts a fact not in the tags.
function fallbackBlurb(e: Enriched, city: string): string {
  if (e.extract) return trimWords(e.extract, 85);

  const osm = e.osm ?? {};
  const type = e.typeLabel.toLowerCase();
  const year = yearFrom(osm);
  const sentences: string[] = [];

  // Lead — prefer the OSM description verbatim (cleaned); otherwise an
  // identifying sentence shaped by whatever structural tags exist.
  if (osm.description) {
    sentences.push(tidyDescription(osm.description));
  } else {
    const parts: string[] = [`${e.name}, ${aOrAn(type)} ${type} in ${city}`];
    if (osm.street) parts[0] += ` on ${cleanFragment(osm.street)}`;
    if (osm.religion && type === "place of worship") {
      parts.push(`serving the ${cleanFragment(osm.religion)} community`);
    } else if (osm.operator) {
      parts.push(`run by ${cleanFragment(osm.operator)}`);
    }
    sentences.push(parts.join(", ") + ".");
  }

  // Era — only if a real year is present in the tags.
  if (year) {
    if (osm.architect) {
      sentences.push(
        `It dates to ${year}, the work of ${cleanFragment(osm.architect)}.`
      );
    } else {
      sentences.push(`The fabric dates to ${year}.`);
    }
  } else if (osm.architect) {
    sentences.push(`It is the work of ${cleanFragment(osm.architect)}.`);
  }

  // Historic / heritage framing, or the inscription if one is recorded.
  if (osm.inscription) {
    sentences.push(`An inscription reads: "${cleanFragment(osm.inscription)}".`);
  } else if (osm.heritage || osm.historic) {
    const what = osm.historic
      ? cleanFragment(osm.historic).replace(/_/g, " ")
      : "heritage";
    sentences.push(
      `It is logged as a marked ${what} feature rather than a casual one.`
    );
  }

  // If we still only have the bare identifying line, add a type-varied,
  // non-generic honest closer.
  if (sentences.length < 2) {
    sentences.push(bareCloser(e.typeLabel, e.name));
  }

  return trimWords(sentences.join(" "), 85);
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

// A stop is "rich" enough to hand to the LLM only when its Wikipedia
// extract has real substance. Below this, the model has nothing to write
// from and pads with hedge prose ("its architectural details and community
// significance waiting to be appreciated") — exactly what the deterministic
// fallbackBlurb is built to avoid.
const RICH_EXTRACT_CHARS = 200;

function isRich(e: Enriched): boolean {
  return !!e.extract && e.extract.length >= RICH_EXTRACT_CHARS;
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

  // Partition: only rich stops are handed to the LLM. Thin stops always
  // get the OSM-grounded deterministic blurb so the prose stays honest
  // about what's actually known.
  const richIdx: number[] = [];
  const thinIdx: number[] = [];
  stops.forEach((s, i) => (isRich(s) ? richIdx : thinIdx).push(i));

  // If nothing is rich, there's no model voice to apply — go straight to
  // the deterministic narration so we don't burn a Groq call to produce
  // intro/outro padding over a tour with no source material at all.
  if (richIdx.length === 0) return fallbackNarration(stops, city, region, tags);

  const richSources = richIdx
    .map((i) => {
      const s = stops[i];
      return `STOP ${i + 1} (${s.name}, ${s.typeLabel})\nSOURCE: ${s.extract.slice(0, 900)}`;
    })
    .join("\n\n");

  // Give the model the full ordered list of stop names/types so the intro
  // and outro can land the whole walk, even when some stops are thin and
  // won't get an LLM blurb.
  const stopList = stops
    .map((s, i) => `${i + 1}. ${s.name} (${s.typeLabel})`)
    .join("\n");

  const richIndexList = richIdx.map((i) => i + 1).join(", ");

  const system =
    "You are a literary travel writer in the register of Monocle or Cereal magazine: " +
    "observational, dry, precise, never breathless. You write walking-tour narration " +
    "GROUNDED STRICTLY in the provided SOURCE text. Do not invent facts, dates, names, " +
    "or anecdotes. Do not pad: if the source is brief, the blurb is brief. " +
    "Return ONLY valid JSON.";

  const user =
    `City: ${city}, ${region}. Interests: ${tags.join(", ")}. Duration: ${durationMin} min.\n\n` +
    `Stops in walking order:\n${stopList}\n\n` +
    `SOURCES (only for stops ${richIndexList}):\n\n${richSources}\n\n` +
    `Return JSON with this exact shape: {"intro": string (~55 words, second person, sets ` +
    `the walk up), "outro": string (~40 words, lands the walk at the final stop), ` +
    `"blurbs": { "${richIdx[0] + 1}": string, ... } — an object keyed by stop number, ` +
    `one entry for EACH of stops ${richIndexList} and NO others, each blurb up to ~90 ` +
    `words (fewer is fine — do not pad when the source is sparse), strictly grounded in ` +
    `that stop's SOURCE}. No markdown, no extra keys.`;

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
      blurbs: Record<string, string>;
    };
    if (
      !parsed.intro ||
      !parsed.outro ||
      !parsed.blurbs ||
      typeof parsed.blurbs !== "object"
    ) {
      throw new Error("LLM returned malformed narration");
    }

    // Splice: LLM blurbs for rich stops (by 1-indexed stop number),
    // deterministic blurbs for thin ones. If the LLM omits a rich stop,
    // fall back to its extract trimmed — never leave a slot empty.
    const blurbs: string[] = stops.map((s, i) => {
      if (isRich(s)) {
        const fromLLM = parsed.blurbs[String(i + 1)];
        if (fromLLM && fromLLM.trim()) return fromLLM.trim();
        return trimWords(s.extract, 85);
      }
      return fallbackBlurb(s, city);
    });

    return { intro: parsed.intro, outro: parsed.outro, blurbs, narrated: true };
  } catch {
    // Any LLM failure → grounded fallback rather than a broken tour.
    return fallbackNarration(stops, city, region, tags);
  }
}
