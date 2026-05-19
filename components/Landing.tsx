// Landing — magazine masthead, dropcap'd hero, editorial postcard grid, colophon.
// Presentational; reads from typed data, navigates via App Router links.

import Link from "next/link";
import { Postcard } from "./Postcard";
import { ECHO_PARK_TOUR, EXAMPLE_TOURS } from "@/lib/data";
import { listTours } from "@/lib/pipeline/cache";
import type { ExampleTour } from "@/lib/types";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const tourHref = (t: ExampleTour) => `/${slugify(t.city)}/${ECHO_PARK_TOUR.slug}`;

type Tone = ExampleTour["tone"];
type Span = ExampleTour["span"];

const TONES: Tone[] = ["ochre", "terra", "ink", "rose", "sage", "brick", "stone"];
const SPANS: Span[] = ["wide", "tall"];

interface PostcardCard {
  key: string;
  href: string;
  n: string;
  min: number;
  city: string;
  region: string;
  tags: string;
  tone: Tone;
  span: Span;
}

export async function Landing() {
  const tours = await listTours(9);

  const cards: PostcardCard[] =
    tours.length > 0
      ? tours.map((tour, i) => ({
          key: tour.slug,
          href: `/${slugify(tour.city) || "walk"}/${tour.slug}`,
          n: String(i + 1).padStart(2, "0"),
          min: tour.duration,
          city: tour.city,
          region: tour.region,
          tags: tour.tags.join(", "),
          tone: TONES[i % TONES.length],
          span: SPANS[i % SPANS.length],
        }))
      : EXAMPLE_TOURS.map((t) => ({
          key: t.n,
          href: tourHref(t),
          n: t.n,
          min: t.min,
          city: t.city,
          region: t.region,
          tags: t.tags,
          tone: t.tone,
          span: t.span,
        }));

  return (
    <div className="screen landing">
      <header className="masthead">
        <div className="masthead-l">
          <div className="logo">
            <span className="logo-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="22" height="22">
                <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M9 22 Q 13 12, 17 18 T 24 11"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
                <circle cx="9" cy="22" r="1.4" fill="currentColor" />
                <circle cx="24" cy="11" r="1.4" fill="currentColor" />
              </svg>
            </span>
            <span className="logo-word">Saunter</span>
          </div>
        </div>
        <nav className="masthead-r">
          <span className="meta-pill">№14 · May 2026</span>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-eyebrow">
          <span className="rule-short" />
          <span>A field guide, generated</span>
          <span className="rule-short" />
        </div>
        <p className="hero-lede">
          <span className="dropcap">S</span>aunter writes a walking tour of any neighborhood. Tell us
          where you are, how long you have, and what you want to see. A quiet page arrives with a
          map, a handful of stops, and audio for the walk.
        </p>
        <div className="hero-action">
          <Link className="hero-link" href="/new">
            Make your own <span className="arrow">→</span>
          </Link>
        </div>
      </section>

      <section className="essays">
        <div className="section-head">
          <span className="section-no">No. 01</span>
          <h2 className="section-title">Recently walked</h2>
          <span className="section-meta">Nine of twenty</span>
        </div>

        <div className="postcards">
          {cards.map((c, i) => (
            <Link
              key={c.key}
              href={c.href}
              className={`postcard tone-${c.tone} span-${c.span}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="postcard-stamp">
                <span className="stamp-no">{c.n}</span>
                <span className="stamp-rule" />
                <span className="stamp-min">{c.min} min</span>
              </div>
              <div className="postcard-art" aria-hidden="true">
                <Postcard tone={c.tone} />
              </div>
              <div className="postcard-foot">
                <h3 className="postcard-city">{c.city}</h3>
                <p className="postcard-region">{c.region}</p>
                <p className="postcard-tags">{c.tags}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <footer className="colophon">
        <p className="colophon-line">
          Built on <em>OpenStreetMap</em>, <em>Wikipedia</em>, and <em>Wikimedia Commons</em>.
        </p>
      </footer>
    </div>
  );
}
