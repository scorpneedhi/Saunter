import { ImageResponse } from "next/og";
import { ECHO_PARK_ROUTE } from "@/lib/data";
import { resolveTour } from "@/lib/pipeline/resolve";

export const runtime = "nodejs";
export const alt = "A generated walking tour from Saunter";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: { city: string; slug: string };
}) {
  const { tour } = await resolveTour(params.slug);
  const route = tour.route ?? ECHO_PARK_ROUTE;

  // Render the route + stops as a single SVG, embedded as an <img> so Satori
  // rasterizes it rather than trying to lay out nested SVG children.
  const PW = 440;
  const PH = 470;
  const routePts = route.map(([x, y]) => `${x * PW},${y * PH}`).join(" ");
  const dots = tour.stops
    .map(
      (s) =>
        `<circle cx="${s.coord.x * PW}" cy="${s.coord.y * PH}" r="13" fill="#2e4a32" stroke="#f4ede0" stroke-width="3"/>`
    )
    .join("");
  const mapSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='${PW}' height='${PH}' viewBox='0 0 ${PW} ${PH}'><rect width='${PW}' height='${PH}' fill='#faf6ec'/><polyline points='${routePts}' fill='none' stroke='#2e4a32' stroke-width='6' stroke-linecap='round' stroke-linejoin='round' opacity='0.85'/>${dots}</svg>`;
  const mapSrc = `data:image/svg+xml;utf8,${encodeURIComponent(mapSvg)}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background:
            "radial-gradient(120% 80% at 30% 0%, #efe7d6 0%, #e3d8be 60%, #d6c7a4 100%)",
          color: "#2a2620",
          padding: 64,
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            paddingRight: 56,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "rgba(42,38,32,0.55)",
            }}
          >
            Saunter — a field guide, generated
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 74, lineHeight: 1.05, fontWeight: 600 }}>
              A {tour.duration}-minute walk
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 74,
                lineHeight: 1.05,
                fontWeight: 600,
                fontStyle: "italic",
                color: "#2e4a32",
              }}
            >
              through {tour.city}
            </div>
            <div style={{ display: "flex", marginTop: 24, fontSize: 26, color: "#5a544a" }}>
              {tour.region} · {tour.tags.join(" + ")} · {tour.stops_count} stops
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 22, color: "rgba(42,38,32,0.55)" }}>
            saunter.app
          </div>
        </div>

        <div
          style={{
            display: "flex",
            width: 480,
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid #c9bea6",
            background: "rgba(250,246,236,0.6)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mapSrc} width={PW} height={PH} alt="" />
        </div>
      </div>
    ),
    { ...size }
  );
}
