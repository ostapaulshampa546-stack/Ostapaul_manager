import type { Metadata } from "next";
import { SectorLanding } from "@/components/site/SectorLanding";
import { SECTOR_PAGES } from "@/lib/site-content";

const page = SECTOR_PAGES.find((p) => p.slug === "ecole")!;
export const metadata: Metadata = { title: page.name, description: page.intro, openGraph: { title: `${page.name} — OSTAPAUL MANAGER`, description: page.intro } };

export default function Page() {
  return <SectorLanding page={page} />;
}
