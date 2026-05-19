// Custom MapLibre "paper" style — echoes the field-guide / zine aesthetic of
// the hand-styled SVG in PaperMap.tsx (cream page, faded ink, muted sage parks,
// blue-grey water). Built on OpenFreeMap's free planet vector tiles
// (https://openfreemap.org) — public, no API key, OSM-derived.
//
// The source is the OpenMapTiles schema served by OpenFreeMap. We hand-pick a
// minimal set of layers and recolor them; everything else (POIs, busy labels,
// transit, boundaries) is intentionally omitted for a calm, illustrated map.
//
// Palette is kept in lockstep, conceptually, with the CSS tokens in
// app/globals.css (--paper #f4ede0, --ink #2a2620, etc.).

import type { StyleSpecification } from "maplibre-gl";

// Field-guide palette (mirrors app/globals.css :root tokens).
const PAPER = "#f4ede0"; // --paper : page background
const PAPER_DEEP = "#ebe1cb"; // --paper-deep : landuse fill
const PAPER_EDGE = "#d9cdb1"; // --paper-edge : building fill
const INK = "#2a2620"; // --ink : label text
const INK_SOFT = "#8b8275"; // --ink-soft : minor label text / halo on dark
const ROAD_TAN = "#c4b08c"; // warm tan roads (matches SVG roads)
const ROAD_CASING = "#d9cdb1"; // soft casing
const WATER = "#b4c8d2"; // muted blue-grey water
const WATER_LINE = "#708a96"; // water outline / rivers
const PARK_SAGE = "#bcc9a4"; // muted sage parks / green landuse
const WOOD_SAGE = "#aebb96"; // slightly deeper sage for woods

// OpenFreeMap public planet tiles (OpenMapTiles schema). No key required.
const OPENFREEMAP_TILES = "https://tiles.openfreemap.org/planet";

// A serif-leaning glyph stack. OpenFreeMap hosts Noto fonts; "Noto Serif"
// gives the field-guide plate feel, with a sans fallback that always exists.
const SERIF_FONT = ["Noto Serif Italic", "Noto Sans Regular"];
const LABEL_FONT = ["Noto Serif Regular", "Noto Sans Regular"];

export function buildPaperStyle(): StyleSpecification {
  return {
    version: 8,
    name: "Saunter Paper",
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {
      ofm: {
        type: "vector",
        url: OPENFREEMAP_TILES,
        attribution:
          '© <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      },
    },
    layers: [
      // Paper page.
      {
        id: "background",
        type: "background",
        paint: { "background-color": PAPER },
      },

      // Land use / parks — muted sage, sparing.
      {
        id: "landuse-park",
        type: "fill",
        source: "ofm",
        "source-layer": "landuse",
        filter: ["in", "class", "park", "cemetery", "recreation_ground"],
        paint: { "fill-color": PARK_SAGE, "fill-opacity": 0.55 },
      },
      {
        id: "landcover-wood",
        type: "fill",
        source: "ofm",
        "source-layer": "landcover",
        filter: ["in", "class", "wood", "grass", "scrub"],
        paint: { "fill-color": WOOD_SAGE, "fill-opacity": 0.4 },
      },
      {
        id: "landuse-residential",
        type: "fill",
        source: "ofm",
        "source-layer": "landuse",
        filter: ["in", "class", "residential", "neighbourhood"],
        paint: { "fill-color": PAPER_DEEP, "fill-opacity": 0.45 },
      },

      // Water — muted blue-grey, with a faint outline echoing the SVG.
      {
        id: "water",
        type: "fill",
        source: "ofm",
        "source-layer": "water",
        filter: ["!=", "intermittent", 1],
        paint: { "fill-color": WATER, "fill-opacity": 0.85 },
      },
      {
        id: "waterway",
        type: "line",
        source: "ofm",
        "source-layer": "waterway",
        paint: { "line-color": WATER_LINE, "line-width": 1, "line-opacity": 0.5 },
      },

      // Roads — warm tan with a soft paper casing (mirrors the SVG roads).
      {
        id: "road-casing",
        type: "line",
        source: "ofm",
        "source-layer": "transportation",
        filter: ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ROAD_CASING,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            2.5,
            16,
            9,
          ],
          "line-opacity": 0.7,
        },
      },
      {
        id: "road-minor",
        type: "line",
        source: "ofm",
        "source-layer": "transportation",
        filter: ["in", "class", "minor", "service"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ROAD_TAN,
          "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.5, 18, 4],
          "line-opacity": 0.55,
        },
      },
      {
        id: "road-major",
        type: "line",
        source: "ofm",
        "source-layer": "transportation",
        filter: ["in", "class", "motorway", "trunk", "primary", "secondary", "tertiary"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ROAD_TAN,
          "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1, 16, 6],
          "line-opacity": 0.7,
        },
      },
      {
        id: "path",
        type: "line",
        source: "ofm",
        "source-layer": "transportation",
        filter: ["in", "class", "path", "track", "pedestrian"],
        layout: { "line-cap": "round" },
        paint: {
          "line-color": ROAD_TAN,
          "line-width": ["interpolate", ["linear"], ["zoom"], 14, 0.5, 18, 2],
          "line-dasharray": [2, 2],
          "line-opacity": 0.5,
        },
      },

      // Buildings — faint warm-grey blocks, like the SVG.
      {
        id: "building",
        type: "fill",
        source: "ofm",
        "source-layer": "building",
        minzoom: 14,
        paint: {
          "fill-color": PAPER_EDGE,
          "fill-opacity": 0.45,
          "fill-outline-color": "rgba(82,72,56,0.25)",
        },
      },

      // A restrained set of place labels (locality only), serif-ish.
      {
        id: "place-city",
        type: "symbol",
        source: "ofm",
        "source-layer": "place",
        filter: ["in", "class", "city", "town"],
        layout: {
          "text-field": ["get", "name"],
          "text-font": SERIF_FONT,
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 13, 14, 19],
          "text-transform": "none",
          "text-letter-spacing": 0.04,
          "text-max-width": 7,
        },
        paint: {
          "text-color": INK,
          "text-halo-color": PAPER,
          "text-halo-width": 1.6,
          "text-halo-blur": 0.5,
        },
      },
      {
        id: "place-suburb",
        type: "symbol",
        source: "ofm",
        "source-layer": "place",
        filter: ["in", "class", "suburb", "neighbourhood", "village"],
        minzoom: 12,
        layout: {
          "text-field": ["get", "name"],
          "text-font": LABEL_FONT,
          "text-size": ["interpolate", ["linear"], ["zoom"], 12, 11, 16, 14],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.12,
          "text-max-width": 8,
        },
        paint: {
          "text-color": INK_SOFT,
          "text-halo-color": PAPER,
          "text-halo-width": 1.4,
        },
      },
    ],
  };
}
