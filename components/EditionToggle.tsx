"use client";

// Light / dusk edition toggle. Persists to localStorage and applies
// `data-edition` on <html> so globals.css's [data-edition="dusk"] palette
// activates everywhere. A sibling inline script in app/layout.tsx applies the
// stored value before paint (see EDITION_BOOTSTRAP), so the page never flashes
// in the wrong palette on reload.

import React from "react";

const KEY = "saunter-edition";
type Edition = "light" | "dusk";

function readEdition(): Edition {
  if (typeof document === "undefined") return "light";
  const e = document.documentElement.dataset.edition;
  return e === "dusk" ? "dusk" : "light";
}

function applyEdition(e: Edition) {
  if (typeof document === "undefined") return;
  if (e === "light") {
    delete document.documentElement.dataset.edition;
  } else {
    document.documentElement.dataset.edition = e;
  }
  try {
    localStorage.setItem(KEY, e);
  } catch {
    // private mode / quota — ignore
  }
}

export function EditionToggle({ className = "" }: { className?: string }) {
  // Sync from documentElement after mount. We don't read on the server, so the
  // initial markup matches whatever the SSR pass produced; the bootstrap script
  // has already painted with the right palette, and this state catches up.
  const [edition, setEdition] = React.useState<Edition>("light");
  React.useEffect(() => {
    setEdition(readEdition());
  }, []);

  const next: Edition = edition === "light" ? "dusk" : "light";
  const label = `Switch to ${next} edition`;

  return (
    <button
      type="button"
      className={`edition-toggle ${className}`}
      aria-label={label}
      title={label}
      onClick={() => {
        applyEdition(next);
        setEdition(next);
      }}
    >
      {edition === "light" ? (
        // Moon — currently light, click to go dusk
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a.4.4 0 0 0-.6-.4 6.4 6.4 0 1 0 8 8 .4.4 0 0 0-.4-.6 5.6 5.6 0 0 1-.2-.2Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        // Sun — currently dusk, click to go light
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="3" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <line x1="8" y1="1.6" x2="8" y2="3.2" />
            <line x1="8" y1="12.8" x2="8" y2="14.4" />
            <line x1="1.6" y1="8" x2="3.2" y2="8" />
            <line x1="12.8" y1="8" x2="14.4" y2="8" />
            <line x1="3.2" y1="3.2" x2="4.4" y2="4.4" />
            <line x1="11.6" y1="11.6" x2="12.8" y2="12.8" />
            <line x1="3.2" y1="12.8" x2="4.4" y2="11.6" />
            <line x1="11.6" y1="4.4" x2="12.8" y2="3.2" />
          </g>
        </svg>
      )}
    </button>
  );
}

// Inline script that runs in <head> before any React. Reads the stored edition
// from localStorage and applies it to <html> so the first paint is correct.
// Wrapped in a try so private-mode localStorage failures never break boot.
export const EDITION_BOOTSTRAP = `(function(){try{var e=localStorage.getItem("${KEY}");if(e==="dusk"){document.documentElement.dataset.edition="dusk";}}catch(_){}})();`;
