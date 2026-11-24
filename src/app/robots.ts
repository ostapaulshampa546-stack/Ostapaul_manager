import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/t/", "/admin", "/app", "/onboarding", "/api/", "/m/", "/v/", "/r/", "/reset-password"] },
    sitemap: `${env.appUrl()}/sitemap.xml`,
  };
}
