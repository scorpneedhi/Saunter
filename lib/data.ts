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
  center: { lat: 34.0768, lng: -118.2602 },
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
      lat: 34.07806,
      lng: -118.26025,
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
      lat: 34.07835,
      lng: -118.26155,
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
      lat: 34.0784,
      lng: -118.2621,
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
      lat: 34.07245,
      lng: -118.2541,
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
      lat: 34.0752,
      lng: -118.2588,
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
      lat: 34.0785,
      lng: -118.2598,
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
      lat: 34.0773,
      lng: -118.2607,
    },
  ],
  // Real OSRM foot route through the 7 stops (router.project-osrm.org),
  // baked as a literal so the fixture needs no runtime network.
  routeLngLat: [
    [-118.260268, 34.078017], [-118.260384, 34.07805], [-118.260457, 34.078062], [-118.260664, 34.078161], [-118.260777, 34.078199], [-118.260811, 34.078211], [-118.261011, 34.0783], [-118.261372, 34.078478], [-118.261397, 34.078496], [-118.261516, 34.078582], [-118.261682, 34.07865], [-118.261741, 34.078564], [-118.261744, 34.078559], [-118.26181, 34.078482], [-118.261841, 34.078454], [-118.261837, 34.078436], [-118.261799, 34.078241], [-118.26184, 34.07821], [-118.261795, 34.078027], [-118.261767, 34.077908], [-118.261711, 34.077916], [-118.261581, 34.077936], [-118.261131, 34.078007], [-118.260907, 34.078048], [-118.260796, 34.07806], [-118.260697, 34.078069], [-118.260572, 34.078074], [-118.260457, 34.078062], [-118.260384, 34.07805], [-118.26021, 34.078001], [-118.259844, 34.077842], [-118.259674, 34.077769], [-118.259479, 34.077684], [-118.259399, 34.07765], [-118.259318, 34.077615], [-118.259088, 34.077515], [-118.258923, 34.077444], [-118.258841, 34.077409], [-118.258513, 34.077267], [-118.258405, 34.077233], [-118.25833, 34.077202], [-118.258026, 34.077056], [-118.257846, 34.076976], [-118.257479, 34.076816], [-118.257361, 34.076764], [-118.257267, 34.076723], [-118.256796, 34.076519], [-118.256616, 34.076442], [-118.256433, 34.076362], [-118.256239, 34.076275], [-118.255946, 34.076149], [-118.255871, 34.076116], [-118.255793, 34.076082], [-118.255576, 34.07599], [-118.255418, 34.075922], [-118.255257, 34.075849], [-118.255072, 34.075769], [-118.254715, 34.075614], [-118.254471, 34.075505], [-118.254377, 34.075464], [-118.254282, 34.075426], [-118.254224, 34.075401], [-118.254005, 34.075305], [-118.253783, 34.075208], [-118.253484, 34.075078], [-118.252949, 34.07484], [-118.252896, 34.074816], [-118.252822, 34.074783], [-118.25273, 34.074742], [-118.252568, 34.07467], [-118.252471, 34.07461], [-118.252252, 34.07444], [-118.252074, 34.074303], [-118.252042, 34.074271], [-118.251971, 34.074193], [-118.252139, 34.074115], [-118.252226, 34.074048], [-118.252294, 34.073975], [-118.252549, 34.073577], [-118.252573, 34.073538], [-118.252614, 34.073469], [-118.253178, 34.072585], [-118.253214, 34.072528], [-118.25326, 34.072455], [-118.253524, 34.072074], [-118.253666, 34.071854], [-118.25374, 34.071893], [-118.254109, 34.072071], [-118.254171, 34.07209], [-118.254171, 34.07209], [-118.254247, 34.072086], [-118.25453, 34.072063], [-118.254637, 34.072122], [-118.25564, 34.072671], [-118.255752, 34.072732], [-118.256317, 34.073039], [-118.256372, 34.073066], [-118.25634, 34.073135], [-118.255933, 34.073761], [-118.25591, 34.073837], [-118.256045, 34.073846], [-118.256127, 34.073859], [-118.2563, 34.07387], [-118.256501, 34.073872], [-118.256689, 34.073856], [-118.256815, 34.073839], [-118.256796, 34.073905], [-118.256721, 34.074144], [-118.256324, 34.075183], [-118.256225, 34.075467], [-118.256147, 34.075631], [-118.255963, 34.075955], [-118.255937, 34.076002], [-118.255871, 34.076116], [-118.255946, 34.076149], [-118.256239, 34.076275], [-118.256433, 34.076362], [-118.256616, 34.076442], [-118.256796, 34.076519], [-118.257267, 34.076723], [-118.257361, 34.076764], [-118.257437, 34.076644], [-118.257598, 34.076388], [-118.257662, 34.076278], [-118.25772, 34.076196], [-118.257798, 34.076069], [-118.258227, 34.075392], [-118.258436, 34.075058], [-118.258523, 34.074922], [-118.258623, 34.07478], [-118.258703, 34.074857], [-118.258719, 34.074884], [-118.258768, 34.074956], [-118.258881, 34.07506], [-118.258918, 34.075087], [-118.258993, 34.07514], [-118.259552, 34.075372], [-118.259623, 34.0754], [-118.259757, 34.075455], [-118.259977, 34.075525], [-118.260265, 34.075591], [-118.260461, 34.075655], [-118.260539, 34.075683], [-118.260734, 34.07576], [-118.260863, 34.075824], [-118.260971, 34.075902], [-118.261086, 34.076016], [-118.261228, 34.076207], [-118.261329, 34.076313], [-118.261251, 34.076468], [-118.261143, 34.076675], [-118.261086, 34.076789], [-118.26072, 34.077603], [-118.260453, 34.078198], [-118.260369, 34.078224], [-118.260269, 34.078436], [-118.260173, 34.078547], [-118.260111, 34.078521], [-118.25989, 34.07843], [-118.259674, 34.07834], [-118.259852, 34.078414], [-118.25989, 34.07843], [-118.260111, 34.078521], [-118.260173, 34.078547], [-118.260129, 34.078597], [-118.259963, 34.07885], [-118.259924, 34.078921], [-118.259871, 34.079001], [-118.259859, 34.079076], [-118.259912, 34.079025], [-118.259959, 34.078986], [-118.259997, 34.078976], [-118.260061, 34.078974], [-118.260128, 34.07898], [-118.260121, 34.079013], [-118.260189, 34.079107], [-118.260318, 34.079323], [-118.260322, 34.079133], [-118.260341, 34.078902], [-118.260373, 34.078712], [-118.260398, 34.078599], [-118.26042, 34.078514], [-118.260455, 34.078407], [-118.260506, 34.078283], [-118.260453, 34.078198], [-118.26072, 34.077603], [-118.260837, 34.077342]
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

// Landing-page seed walks. Used as a fallback when the tour cache is empty
// (e.g. on a fresh DB or no-DB run).
export const EXAMPLE_TOURS: ExampleTour[] = [
  { n: "01", city: "Lisbon", region: "Alfama", min: 75, tags: "miradouros, azulejos, slope" },
  { n: "02", city: "Marrakech", region: "Medina", min: 90, tags: "souks, courtyards, water history" },
  { n: "03", city: "Kyoto", region: "Higashiyama", min: 60, tags: "temples, lanterns, tea" },
  { n: "04", city: "Mexico City", region: "Coyoacán", min: 90, tags: "muralism, courtyards, cantinas" },
  { n: "05", city: "Echo Park", region: "Los Angeles", min: 90, tags: "architecture, public art" },
  { n: "06", city: "Lower East Side", region: "Manhattan", min: 60, tags: "tenement history, signage, delis" },
  { n: "07", city: "Trastevere", region: "Rome", min: 75, tags: "fountains, cobbles, hidden chapels" },
  { n: "08", city: "Berlin", region: "Kreuzberg", min: 90, tags: "post-war, occupation, street art" },
  { n: "09", city: "Hanoi", region: "Old Quarter", min: 60, tags: "guild streets, lakeside, signage" },
];

// The prototype ships a single fleshed-out tour; every postcard routes to it.
export function getTour(_city: string, _slug: string): Tour {
  return ECHO_PARK_TOUR;
}
