import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.appUrl();
  const pages: [string, number][] = [["", 1], ["/restaurant", 0.9], ["/ecole", 0.9], ["/pme", 0.9], ["/pricing", 0.8], ["/faq", 0.6], ["/contact", 0.7], ["/signup", 0.6]];
  return pages.map(([p, priority]) => ({ url: `${base}${p}`, changeFrequency: "weekly", priority }));
}
