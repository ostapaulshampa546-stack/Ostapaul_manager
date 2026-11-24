import type { Metadata } from "next";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { CtaBand } from "@/components/site/SectorLanding";
import { FAQ } from "@/lib/site-content";

export const metadata: Metadata = { title: "Questions fréquentes", description: "Essai gratuit, paiement, connexion faible, sécurité, devises, utilisateurs : toutes les réponses sur OSTAPAUL MANAGER." };

export default function FaqPage() {
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };
  return (
    <main>
      <div className="bg-navy-900"><SiteHeader /></div>
      <section className="mx-auto max-w-3xl px-4 py-14">
        <h1 className="text-3xl font-extrabold">Questions fréquentes</h1>
        <div className="mt-8 space-y-2">
          {FAQ.map((f) => (
            <details key={f.q} className="card py-4">
              <summary className="cursor-pointer font-semibold">{f.q}</summary>
              <p className="mt-2 text-sm text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <CtaBand />
      <SiteFooter />
    </main>
  );
}
