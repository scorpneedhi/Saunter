"use client";

// MapLibreMap — the production-target map: MapLibre GL JS on OpenFreeMap
// vector tiles, rendered with a custom "paper" style that echoes the
// hand-styled SVG (components/PaperMap.tsx, the visual reference).
//
// This is an OPT-IN alternative. The SVG PaperMap remains the default; this
// renders only when NEXT_PUBLIC_USE_MAPLIBRE === "1" (wired in Tour.tsx).
//
// Drop-in: accepts the same props as PaperMap. `route` (0..1 SVG space) and
// `areas` are intentionally IGNORED — this map uses real geography. The route
// is the true OSRM walking polyline (`routeLngLat`, [lng, lat] pairs); it
// falls back to a straight line through the stops only if that is absent.
//
// SSR-safe: maplibre-gl is dynamically imported inside an effect, and the
// server render returns an empty container (no window access at module load).

import React from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Stop, RoutePoint } from "@/lib/types";
import { buildPaperStyle } from "./paperMapStyle";

interface Props {
  stops: Stop[];
  route: RoutePoint[];
  routeLngLat?: [number, number][]; // true OSRM walking polyline, [lng, lat]
  activeStop: number;
  onStopClick?: (n: number) => void;
  accent: string;
  compact?: boolean;
  withCompass?: boolean;
  areas?: { kind: "park" | "water"; points: [number, number][] }[];
  label?: string;
  subLabel?: string;
}

const STOPS_SOURCE = "saunter-stops";
const ROUTE_SOURCE = "saunter-route";
const PAPER = "#f4ede0"; // --paper, for marker halos

// Stops carrying real geography. The pipeline populates lat/lng; the static
// mock does not (those tours should keep using the SVG map).
function geoStops(stops: Stop[]): { n: number; name: string; lng: number; lat: number }[] {
  return stops
    .filter((s) => typeof s.lat === "number" && typeof s.lng === "number")
    .map((s) => ({ n: s.n, name: s.name, lng: s.lng as number, lat: s.lat as number }));
}

export function MapLibreMap({
  stops,
  routeLngLat,
  activeStop,
  onStopClick,
  accent,
  label,
  subLabel,
}: Props) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  // maplibregl.Map — typed loosely to avoid a hard type import at module scope.
  const mapRef = React.useRef<any>(null);
  const readyRef = React.useRef(false);
  // Keep the latest click handler without re-binding map listeners.
  const onStopClickRef = React.useRef(onStopClick);
  onStopClickRef.current = onStopClick;

  const points = React.useMemo(() => geoStops(stops), [stops]);

  const stopsGeoJSON = React.useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: points.map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: { n: p.n, name: p.name },
      })),
    }),
    [points]
  );

  // Route: the true OSRM walking polyline when available, else a straight
  // line through the stops in order as a graceful fallback.
  const routeGeoJSON = React.useMemo(() => {
    const coords: [number, number][] | null =
      routeLngLat && routeLngLat.length >= 2
        ? routeLngLat
        : points.length >= 2
        ? points.map((p) => [p.lng, p.lat] as [number, number])
        : null;
    return {
      type: "FeatureCollection" as const,
      features: coords
        ? [
            {
              type: "Feature" as const,
              geometry: { type: "LineString" as const, coordinates: coords },
              properties: {},
            },
          ]
        : [],
    };
  }, [routeLngLat, points]);

  // Init the map once (client only). maplibre-gl + its CSS are imported here
  // so nothing touches `window` during SSR / next build static analysis.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      if (cancelled || !containerRef.current) return;

      const start = points[0] ?? { lng: -118.2606, lat: 34.0782 };
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: buildPaperStyle(),
        center: [start.lng, start.lat],
        zoom: 14,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
        renderWorldCopies: false,
      });
      mapRef.current = map;

      // Calm, flat map: no rotation/pitch gestures.
      map.touchZoomRotate.disableRotation();
      map.keyboard.disable();

      // Compact required attribution (OpenFreeMap / OSM).
      map.addControl(
        new maplibregl.AttributionControl({ compact: true }),
        "bottom-right"
      );
      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
        "top-right"
      );

      map.on("load", () => {
        if (cancelled) return;

        map.addSource(ROUTE_SOURCE, { type: "geojson", data: routeGeoJSON });
        map.addLayer({
          id: "saunter-route-line",
          type: "line",
          source: ROUTE_SOURCE,
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": accent,
            "line-width": 4,
            "line-opacity": 0.85,
          },
        });

        map.addSource(STOPS_SOURCE, { type: "geojson", data: stopsGeoJSON });

        // Paper halo behind each marker.
        map.addLayer({
          id: "saunter-stops-halo",
          type: "circle",
          source: STOPS_SOURCE,
          paint: {
            "circle-radius": [
              "case",
              ["==", ["get", "n"], ["literal", activeStop]],
              22,
              18,
            ],
            "circle-color": PAPER,
            "circle-opacity": 0.85,
          },
        });

        // Accent disc; the active stop is larger.
        map.addLayer({
          id: "saunter-stops-dot",
          type: "circle",
          source: STOPS_SOURCE,
          paint: {
            "circle-radius": [
              "case",
              ["==", ["get", "n"], ["literal", activeStop]],
              17,
              13,
            ],
            "circle-color": accent,
            "circle-stroke-color": PAPER,
            "circle-stroke-width": 2.5,
          },
        });

        // Stop number.
        map.addLayer({
          id: "saunter-stops-label",
          type: "symbol",
          source: STOPS_SOURCE,
          layout: {
            "text-field": ["to-string", ["get", "n"]],
            // OpenFreeMap serves only Noto Sans {Regular,Bold,Italic};
            // Bold keeps the numbered markers legible.
            "text-font": ["Noto Sans Bold"],
            "text-size": [
              "case",
              ["==", ["get", "n"], ["literal", activeStop]],
              17,
              14,
            ],
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: { "text-color": PAPER },
        });

        // Click a marker -> select the stop.
        const hit = (e: any) => {
          const f = e.features && e.features[0];
          if (!f) return;
          const n = f.properties && f.properties.n;
          if (typeof n === "number" && onStopClickRef.current) {
            onStopClickRef.current(n);
          }
        };
        map.on("click", "saunter-stops-dot", hit);
        map.on("click", "saunter-stops-halo", hit);
        const enter = () => {
          map.getCanvas().style.cursor = "pointer";
        };
        const leave = () => {
          map.getCanvas().style.cursor = "";
        };
        map.on("mouseenter", "saunter-stops-dot", enter);
        map.on("mouseleave", "saunter-stops-dot", leave);

        // Fit to all stops.
        if (points.length === 1) {
          map.setCenter([points[0].lng, points[0].lat]);
          map.setZoom(15);
        } else if (points.length > 1) {
          const bounds = points.reduce(
            (b, p) => b.extend([p.lng, p.lat] as [number, number]),
            new maplibregl.LngLatBounds(
              [points[0].lng, points[0].lat],
              [points[0].lng, points[0].lat]
            )
          );
          map.fitBounds(bounds, { padding: 64, duration: 0, maxZoom: 16 });
        }

        readyRef.current = true;
      });
    })();

    return () => {
      cancelled = true;
      readyRef.current = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // Init once; data/active updates are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push updated GeoJSON when stops/route change.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const stopsSrc = map.getSource(STOPS_SOURCE);
    if (stopsSrc) stopsSrc.setData(stopsGeoJSON);
    const routeSrc = map.getSource(ROUTE_SOURCE);
    if (routeSrc) routeSrc.setData(routeGeoJSON);
  }, [stopsGeoJSON, routeGeoJSON]);

  // Re-style for the active stop and ease the camera to it.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    if (map.getLayer("saunter-stops-halo")) {
      map.setPaintProperty("saunter-stops-halo", "circle-radius", [
        "case",
        ["==", ["get", "n"], ["literal", activeStop]],
        22,
        18,
      ]);
    }
    if (map.getLayer("saunter-stops-dot")) {
      map.setPaintProperty("saunter-stops-dot", "circle-radius", [
        "case",
        ["==", ["get", "n"], ["literal", activeStop]],
        17,
        13,
      ]);
    }
    if (map.getLayer("saunter-stops-label")) {
      map.setLayoutProperty("saunter-stops-label", "text-size", [
        "case",
        ["==", ["get", "n"], ["literal", activeStop]],
        17,
        14,
      ]);
    }

    const active = points.find((p) => p.n === activeStop);
    if (active) {
      map.easeTo({ center: [active.lng, active.lat], duration: 700 });
    }
  }, [activeStop, points]);

  return (
    <div className="papermap-wrap maplibre-wrap" aria-label={label}>
      <div ref={containerRef} className="maplibre-canvas" />
      {(label || subLabel) && (
        <div className="maplibre-plate">
          {label && <span className="maplibre-plate-title">{label}</span>}
          {subLabel && <span className="maplibre-plate-sub">{subLabel}</span>}
        </div>
      )}
    </div>
  );
}
