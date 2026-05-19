import type { Metadata } from "next";
import { Tour } from "@/components/Tour";
import { resolveTour } from "@/lib/pipeline/resolve";

export const dynamic = "force-dynamic";

interface Params {
  params: { city: string; slug: string };
}

const firstSentence = (s: string) => {
  const m = s.match(/^.*?[.?!](?:\s|$)/);
  return (m ? m[0] : s).trim();
};

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tour } = await resolveTour(params.slug);
  const title = `A ${tour.duration}-minute walk through ${tour.city}.`;
  const description = firstSentence(tour.intro);
  const url = `/${params.city}/${params.slug}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "article",
      siteName: "Saunter",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function TourPage({ params }: Params) {
  const { tour, route } = await resolveTour(params.slug);
  return (
    <div className="screen-fade">
      <Tour tour={tour} route={route} />
    </div>
  );
}
