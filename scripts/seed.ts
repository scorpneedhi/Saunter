// Seed script — pre-generates a spread of real tours so the landing-page
// postcard grid is populated on first load. Runs the full pipeline for ~20
// curated, well-known WALKABLE neighborhoods across varied world regions.
//
// Persists to Postgres only when DATABASE_URL is set in the shell; otherwise
// the pipeline degrades to the in-memory store (see lib/pipeline/cache.ts).
// Sparse areas legitimately throw a pipeline "select" error — each iteration
// is isolated so one failure never aborts the batch.
//
//   DATABASE_URL=... npm run seed
//
// NOTE: never point this at a production database.

import { generateTour, type GenerateInput } from "../lib/pipeline/generate";

const SEED: GenerateInput[] = [
  // North America
  { location: "Greenwich Village, New York, USA", duration: 90, tags: ["history", "architecture"] },
  { location: "French Quarter, New Orleans, USA", duration: 60, tags: ["history", "food and drink"] },
  { location: "Mission District, San Francisco, USA", duration: 60, tags: ["public art", "food and drink"] },
  { location: "The Plateau, Montreal, Canada", duration: 90, tags: ["architecture", "hidden gems"] },
  { location: "Pioneer Square, Seattle, USA", duration: 30, tags: ["history", "architecture"] },

  // Europe
  { location: "Le Marais, Paris, France", duration: 120, tags: ["architecture", "history", "public art"] },
  { location: "Trastevere, Rome, Italy", duration: 90, tags: ["history", "food and drink"] },
  { location: "Gràcia, Barcelona, Spain", duration: 60, tags: ["architecture", "hidden gems"] },
  { location: "Kreuzberg, Berlin, Germany", duration: 90, tags: ["public art", "food and drink"] },
  { location: "Jordaan, Amsterdam, Netherlands", duration: 60, tags: ["architecture", "history"] },
  { location: "Alfama, Lisbon, Portugal", duration: 30, tags: ["history", "hidden gems"] },
  { location: "Södermalm, Stockholm, Sweden", duration: 90, tags: ["hidden gems", "nature"] },

  // Asia
  { location: "Yanaka, Tokyo, Japan", duration: 60, tags: ["history", "hidden gems"] },
  { location: "Tiong Bahru, Singapore", duration: 30, tags: ["architecture", "food and drink"] },
  { location: "Sheung Wan, Hong Kong", duration: 60, tags: ["public art", "history"] },
  { location: "Bukchon Hanok Village, Seoul, South Korea", duration: 90, tags: ["architecture", "history"] },
  { location: "Fort Kochi, Kerala, India", duration: 120, tags: ["history", "nature", "hidden gems"] },

  // Southern Hemisphere / Oceania / Africa / South America
  { location: "Surry Hills, Sydney, Australia", duration: 60, tags: ["food and drink", "public art"] },
  { location: "Bo-Kaap, Cape Town, South Africa", duration: 30, tags: ["architecture", "history"] },
  { location: "San Telmo, Buenos Aires, Argentina", duration: 90, tags: ["history", "public art"] },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL not set — refusing to run. Without it the pipeline " +
        "writes to an in-memory store that is discarded on exit, so every " +
        "generated tour would be silently lost. Re-run with the env loaded, " +
        'e.g. node --env-file=.env.local --import tsx scripts/seed.ts'
    );
    process.exit(1);
  }

  let ok = 0;
  let skipped = 0;

  for (const input of SEED) {
    try {
      await generateTour(input);
      ok += 1;
      console.log(`[ok] ${input.location}`);
    } catch (err) {
      skipped += 1;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[skip] ${input.location}: ${msg}`);
    }
    // Be gentle on Nominatim/Overpass/OSRM rate limits between runs.
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log(
    `\nSeed complete — ${ok} generated, ${skipped} skipped, ${SEED.length} total.`
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
