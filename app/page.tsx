import { Landing } from "@/components/Landing";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <div className="screen-fade">
      <Landing />
    </div>
  );
}
