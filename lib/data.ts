// Mock data for Saunter.
// Echo Park, Los Angeles — 90 min walk — architecture + public art.
// One fully fleshed-out example so the tour page reviews without a backend.

import type { Tour, RoutePoint, ExampleTour } from "./types";

export const ECHO_PARK_TOUR: Tour = {
  city: "Echo Park",
  region: "Los Angeles",
  slug: "echo-park-architecture-public-art",
  duration: 90,
  distanceKm: 3.4,
  distanceMi: 2.1,
  stops_count: 7,
  tags: ["architecture", "public art"],
  weather: "Overcast, 64°F",
  bestTime: "Late afternoon",
  intro:
    "Echo Park earns its name twice — first from the lake at its center, then from the way its history keeps repeating in the buildings around it. This walk threads through the neighborhood's quieter blocks, from a 1920s revivalist temple to a corner store that sells supplies for time travelers, taking in the lake, the murals, and the steep residential hills that look back across the city like a balcony.",
  outro:
    "End at the lake. Sit on a bench facing the lotus beds. The hills you walked are now behind you; the towers of downtown shimmer to the east. Saunter is, in the end, an excuse to do exactly this.",
  bounds: { lat: [34.07, 34.09], lng: [-118.27, -118.25] },
  stops: [
    {
      n: 1,
      name: "Angelus Temple",
      type: "Place of worship · 1923",
      coord: { x: 0.18, y: 0.74 },
      blurb:
        "A domed concrete megachurch built by the radio evangelist Aimee Semple McPherson, who broadcast sermons here when broadcasting itself was new. The dome was, briefly, the largest unsupported concrete span in North America. From the sidewalk it still looks like a small civic auditorium that wandered out of a 1920s world's fair and stayed.",
      photoTone: "warm-grey",
      walkMin: 0,
    },
    {
      n: 2,
      name: "Jensen's Recreation Center",
      type: "Mixed-use · 1924",
      coord: { x: 0.3, y: 0.62 },
      blurb:
        "A two-storey brick block topped by a long, unfussy neon sign reading 'Bowling · Billiards'. The sign has been there, off and on, since the year it was built. Inside is an apartment building now, but the cornice and the painted ghost-ads on the side wall give the corner an air of arrested motion.",
      photoTone: "brick",
      walkMin: 7,
    },
    {
      n: 3,
      name: "Time Travel Mart",
      type: "Public art / shopfront · 2007",
      coord: { x: 0.42, y: 0.5 },
      blurb:
        "Ostensibly a corner store stocked with mammoth chunks, robot milk, and primitive technology. In practice, the storefront of the nonprofit writing tutor 826LA. The window display changes with the season and the inventory is mostly a long, sustained joke. Take a photo of the awning; do not actually try to buy the dinosaur eggs.",
      photoTone: "sage",
      walkMin: 14,
    },
    {
      n: 4,
      name: "Carroll Avenue",
      type: "Historic district · 1880s–1890s",
      coord: { x: 0.58, y: 0.42 },
      blurb:
        "One block of Eastlake and Queen Anne Victorians that survived because nobody got around to demolishing them. They sit shoulder to shoulder, painted in deliberate ice-cream colors, looking as though they have wandered in from a different American city entirely. Most are private homes. Stand on the sidewalk, do not climb the porches.",
      photoTone: "cream",
      walkMin: 22,
    },
    {
      n: 5,
      name: "Aimee Semple McPherson Parsonage",
      type: "Residence · 1925",
      coord: { x: 0.5, y: 0.3 },
      blurb:
        "A small, comparatively modest house where the evangelist of Stop 1 lived between sermons. The lot slopes; the front door is two storeys up from the back. From the corner you can see both the parsonage and, framed neatly between two palms, the dome you started at — a small piece of choreography that probably wasn't accidental.",
      photoTone: "warm-grey",
      walkMin: 31,
    },
    {
      n: 6,
      name: "Pioneer Market Mural",
      type: "Public art · 1981, restored 2018",
      coord: { x: 0.38, y: 0.22 },
      blurb:
        "A long wall painting in faded primary colors depicting the neighborhood's working day — vendors, mechanics, mothers, a fruit cart, a pair of dogs. It was painted over once and uncovered by community petition. Stand far enough back and the wall reads almost as a single, slow horizontal sentence.",
      photoTone: "brick",
      walkMin: 41,
    },
    {
      n: 7,
      name: "Echo Park Lake & Lady of the Lake",
      type: "Park · 1895 · sculpture 1934",
      coord: { x: 0.7, y: 0.18 },
      blurb:
        "End at the lotus beds. The Lady of the Lake, a WPA-era concrete figure holding her arms out toward the water, was lost for forty years, found in a city yard, and re-installed here in 1986. The downtown skyline sits behind her like a stage set. Bring something to drink. Sit for a while before you walk back.",
      photoTone: "sage",
      walkMin: 52,
    },
  ],
};

// Hand-drawn-feeling polyline through the stops with small jitters.
export const ECHO_PARK_ROUTE: RoutePoint[] = [
  [0.18, 0.74], [0.2, 0.71], [0.23, 0.68], [0.26, 0.65], [0.3, 0.62],
  [0.33, 0.59], [0.36, 0.56], [0.39, 0.53], [0.42, 0.5],
  [0.46, 0.47], [0.5, 0.45], [0.54, 0.43], [0.58, 0.42],
  [0.56, 0.38], [0.54, 0.35], [0.52, 0.32], [0.5, 0.3],
  [0.46, 0.27], [0.42, 0.25], [0.38, 0.22],
  [0.44, 0.22], [0.5, 0.21], [0.58, 0.2], [0.64, 0.19], [0.7, 0.18],
];

// Landing-page postcard examples.
export const EXAMPLE_TOURS: ExampleTour[] = [
  { n: "01", city: "Lisbon", region: "Alfama", min: 75, tags: "miradouros, azulejos, slope", tone: "ochre", span: "tall" },
  { n: "02", city: "Marrakech", region: "Medina", min: 90, tags: "souks, courtyards, water history", tone: "terra", span: "wide" },
  { n: "03", city: "Kyoto", region: "Higashiyama", min: 60, tags: "temples, lanterns, tea", tone: "ink", span: "tall" },
  { n: "04", city: "Mexico City", region: "Coyoacán", min: 90, tags: "muralism, courtyards, cantinas", tone: "rose", span: "wide" },
  { n: "05", city: "Echo Park", region: "Los Angeles", min: 90, tags: "architecture, public art", tone: "sage", span: "tall" },
  { n: "06", city: "Lower East Side", region: "Manhattan", min: 60, tags: "tenement history, signage, delis", tone: "brick", span: "wide" },
  { n: "07", city: "Trastevere", region: "Rome", min: 75, tags: "fountains, cobbles, hidden chapels", tone: "stone", span: "tall" },
  { n: "08", city: "Berlin", region: "Kreuzberg", min: 90, tags: "post-war, occupation, street art", tone: "ink", span: "wide" },
  { n: "09", city: "Hanoi", region: "Old Quarter", min: 60, tags: "guild streets, lakeside, signage", tone: "ochre", span: "tall" },
];

// The prototype ships a single fleshed-out tour; every postcard routes to it.
export function getTour(_city: string, _slug: string): Tour {
  return ECHO_PARK_TOUR;
}
