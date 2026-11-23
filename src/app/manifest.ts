import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OSTAPAUL MANAGER",
    short_name: "OSTAPAUL",
    description: "Gestion intelligente des restaurants, écoles et PME",
    start_url: "/app",
    display: "standalone",
    background_color: "#0B1F4B",
    theme_color: "#0B1F4B",
    lang: "fr",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
