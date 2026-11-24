import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import { getLocale } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", display: "swap", weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: { default: "AFRILEARN — The complete African learning ecosystem", template: "%s · AFRILEARN" },
  description: "Pan-African learning platform: training-center management, American & British English (CEFR A1–C2), academy, exams and an AI teacher.",
  icons: { icon: "/icon.svg" },
  openGraph: { title: "AFRILEARN", description: "The complete African learning ecosystem", type: "website" },
};

export const viewport: Viewport = { themeColor: "#071233", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${sora.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
