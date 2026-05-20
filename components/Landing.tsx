// Landing — wordmark, hero, clean walk-row list, single colophon line.
// Audio-walk minimal: no masthead pill, no postcards, no dropcap, no ornaments.

import Link from "next/link";
import { ECHO_PARK_TOUR, EXAMPLE_TOURS } from "@/lib/data";
import { listTours } from "@/lib/pipeline/cache";
import type { ExampleTour } from "@/lib/types";
import { EditionToggle } from "@/components/EditionToggle";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const fallbackHref = (t: ExampleTour) => `/${slugify(t.city)}/${ECHO_PARK_TOUR.slug}`;

interface WalkRow {
  key: string;
  href: string;
  city: string;
  region: string;
  tags: string;
  min: number;
}

export async function Landing() {
  const tours = await listTours(9);

  const rows: WalkRow[] =
    tours.length > 0
      ? tours.map((tour) => ({
          key: tour.slug,
          href: `/${slugify(tour.city) || "walk"}/${tour.slug}`,
          city: tour.city,
          region: tour.region,
          tags: tour.tags.join(", "),
          min: tour.duration,
        }))
      : EXAMPLE_TOURS.map((t) => ({
          key: t.n,
          href: fallbackHref(t),
          city: t.city,
          region: t.region,
          tags: t.tags,
          min: t.min,
        }));

  // "9 of N" — show a real count when the cache has tours; otherwise it's the
  // 9 seeded examples and the denominator just matches.
  const total = tours.length > 0 ? Math.max(tours.length, rows.length) : rows.length;

  return (
    <div className="screen landing">
      <header className="topbar">
        <div className="wordmark">
          <span className="mark" aria-hidden="true" />
          <span>Saunter</span>
        </div>
        <div className="topbar-r">
          <span className="meta">Beta</span>
          <EditionToggle />
        </div>
      </header>

      <section className="hero">
        <h1>
          Walking tours,<br />
          <span className="accent">written for you.</span>
        </h1>
        <p>
          Tell Saunter where you are and how long you have. Get a route, a few
          stops worth seeing, and audio for the walk.
        </p>
        <div className="cta-row">
          <Link className="btn btn-accent" href="/new">
            Make a walk
            <span className="btn-arrow">→</span>
          </Link>
        </div>
      </section>

      <section className="walks">
        <div className="walks-head">
          <span className="label">
            Recent walks · <strong>{rows.length} of {total}</strong>
          </span>
        </div>
        {rows.map((r) => (
          <Link key={r.key} href={r.href} className="walk-row">
            <div className="walk-thumb">
              <div className="image-slot" aria-hidden="true">
                <span className="image-slot-label">{r.city}</span>
              </div>
            </div>
            <div className="walk-text">
              <div className="walk-city">{r.city}</div>
              <div className="walk-region">{r.region}</div>
              <div className="walk-tags">{r.tags}</div>
            </div>
            <div className="walk-meta">
              <div className="min">{r.min} min</div>
              <div>walk</div>
            </div>
          </Link>
        ))}
      </section>

      <footer className="colophon">
        Routes drawn from OpenStreetMap. Notes drafted from Wikipedia and
        Wikimedia Commons.
      </footer>
    </div>
  );
}
