import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterSW } from "@/components/RegisterSW";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: { type: "website", locale: "fr_CD", siteName: "OSTAPAUL MANAGER" },
  title: { default: "OSTAPAUL MANAGER", template: "%s · OSTAPAUL MANAGER" },
  description: "Un seul logiciel. Trois secteurs. Une gestion intelligente. Restaurants, écoles, universités et PME en RDC.",
  applicationName: "OSTAPAUL MANAGER",
  icons: { icon: "/icons/icon.svg", apple: "/icons/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#0B1F4B", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen font-sans antialiased">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
