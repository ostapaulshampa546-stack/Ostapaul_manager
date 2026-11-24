import Link from "next/link";
import { Logo } from "@/components/Logo";
import type { Dict } from "@/lib/i18n";

export function SiteFooter({ t }: { t: Dict }) {
  const cols = [
    { title: "AFRILEARN", links: [["/about", t.nav.about], ["/features", t.nav.features], ["/ai-teacher", t.nav.aiTeacher], ["/courses", t.nav.courses]] },
    { title: t.nav.centers, links: [["/centers", t.nav.centers], ["/students", t.nav.students], ["/pricing", t.nav.pricing], ["/register", t.common.register]] },
    { title: t.nav.contact, links: [["/contact", t.nav.contact], ["/faq", t.nav.faq], ["/privacy", t.nav.privacy], ["/terms", t.nav.terms]] },
  ];
  return (
    <footer className="bg-night-950 text-white/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo dark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">{t.common.tagline}.</p>
          <p className="mt-4 text-xs text-white/45">American English · British English · CEFR A1–C2</p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="font-display text-sm font-semibold text-white">{c.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map(([href, label]) => <li key={href}><Link href={href} className="hover:text-gold-400">{label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-white/45 sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} AFRILEARN</p>
          <p>Made for Africa · Built for the world</p>
        </div>
      </div>
    </footer>
  );
}
