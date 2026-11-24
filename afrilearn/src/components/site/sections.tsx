import Link from "next/link";
import { Badge, StatusPill } from "@/components/ui";
import { Reveal, Tilt } from "./Reveal";
import { MODULES, COURSES } from "@/lib/catalog";
import { formatMoney, getPricingData, getPartnerCenters } from "@/lib/public-data";
import type { Dict, Locale } from "@/lib/i18n";

export function ModulesGrid({ t }: { t: Dict }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {MODULES.map((m, i) => {
        const item = t.modules.items[m.key];
        return (
          <Reveal key={m.key} delay={(i % 3) * 0.08}>
            <Tilt className="card h-full p-6">
              <div className="flex items-start justify-between gap-3">
                <span className="text-3xl" aria-hidden="true">{m.icon}</span>
                <StatusPill available={m.available} phase={m.phase} labels={t.common} />
              </div>
              <h3 className="font-display mt-4 text-lg font-semibold text-night-900">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.text}</p>
            </Tilt>
          </Reveal>
        );
      })}
    </div>
  );
}

export function CoursesGrid({ t }: { t: Dict }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {COURSES.map((c, i) => (
        <Reveal key={c.key} delay={(i % 5) * 0.06}>
          <Tilt className={`relative h-44 overflow-hidden rounded-2xl bg-gradient-to-br ${c.color} p-5 text-white shadow-lg`}>
            <div className="absolute -bottom-6 -right-4 text-7xl opacity-20" aria-hidden="true">📘</div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/70">{c.levels}</p>
            <h3 className="font-display mt-2 text-lg font-semibold leading-snug">{t.courses[c.key]}</h3>
            <div className="absolute bottom-4 left-5 flex gap-1.5"><Badge tone="gold">US</Badge><Badge tone="blue">UK</Badge></div>
          </Tilt>
        </Reveal>
      ))}
    </div>
  );
}

export async function PartnersList({ t, locale }: { t: Dict; locale: Locale }) {
  const partners = await getPartnerCenters();
  if (partners.length === 0) {
    return (
      <div className="card flex flex-col items-start gap-4 p-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-muted">{t.home.partnersEmpty}</p>
        <Link href="/register?profile=center_manager" className="btn btn-primary">{t.home.partnersCta}</Link>
      </div>
    );
  }
  const regionName = new Intl.DisplayNames([locale], { type: "region" });
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {partners.map((p) => (
        <div key={p.id} className="card p-5">
          <p className="font-display font-semibold text-night-900">{p.name}</p>
          <p className="text-sm text-muted">{[p.city, regionName.of(p.country_code)].filter(Boolean).join(", ")}</p>
          {p.description && <p className="mt-2 line-clamp-3 text-sm text-muted">{p.description}</p>}
        </div>
      ))}
    </div>
  );
}

export async function PricingTables({ t, locale, country }: { t: Dict; locale: Locale; country: string }) {
  const data = await getPricingData();
  if (!data) return <div className="card p-6 text-muted">{t.pages.pricing.unavailable}</div>;
  const cur = (code: string) => data.currencies.find((c) => c.code === code);
  const groups = [
    { title: t.pages.pricing.centers, plans: data.plans.filter((p) => p.audience === "center"), profile: "center_manager" },
    { title: t.pages.pricing.students, plans: data.plans.filter((p) => p.audience === "student"), profile: "student" },
  ];
  return (
    <div className="space-y-14">
      {groups.map((g) => (
        <div key={g.title}>
          <h2 className="font-display mb-6 text-2xl font-bold text-night-900">{g.title}</h2>
          <div className="grid gap-5 md:grid-cols-3">
            {g.plans.map((p, i) => {
              const prices = data.prices.filter((x) => x.plan_id === p.id && x.country_code === country);
              const features = locale === "fr" ? p.features_fr : p.features_en;
              const featured = i === 1;
              return (
                <div key={p.id} data-testid={`plan-${p.code}`}
                  className={`relative flex flex-col rounded-3xl p-6 ${featured ? "bg-night-900 text-white shadow-glow" : "card"}`}>
                  {featured && <span className="absolute -top-3 right-6 rounded-full bg-gold-500 px-3 py-1 text-xs font-bold text-night-900">★</span>}
                  <h3 className="font-display text-xl font-bold">{p.name}</h3>
                  <p className={`mt-1 text-sm ${featured ? "text-white/70" : "text-muted"}`}>{locale === "fr" ? p.tagline_fr : p.tagline_en}</p>
                  <div className="my-6 min-h-[64px]">
                    {p.is_free ? (
                      <p className="font-display text-4xl font-bold">{t.pages.pricing.free}</p>
                    ) : prices.length > 0 ? prices.map((pr) => (
                      <p key={pr.period} className="font-display text-3xl font-bold">
                        {formatMoney(Number(pr.amount), cur(pr.currency_code), locale)}
                        <span className={`ml-1 text-sm font-medium ${featured ? "text-white/60" : "text-muted"}`}>/ {t.enums.period[pr.period]}</span>
                      </p>
                    )) : (
                      <p className={`text-sm font-medium ${featured ? "text-gold-400" : "text-[#7a5300]"}`}>{t.pages.pricing.notPublished}</p>
                    )}
                  </div>
                  <ul className="flex-1 space-y-2 text-sm">
                    {features.map((f) => <li key={f} className="flex gap-2"><span className="text-gold-500">✓</span><span>{f}</span></li>)}
                  </ul>
                  <Link href={p.is_free || prices.length ? `/register?profile=${g.profile}` : "/contact?kind=center_demo"}
                    className={`btn mt-6 ${featured ? "btn-gold" : "btn-primary"}`}>
                    {p.is_free || prices.length ? t.pages.pricing.choose : t.pages.pricing.contactUs}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      <p className="rounded-2xl bg-royal-50 p-4 text-sm text-royal-700">{t.pages.pricing.paymentsNote}</p>
    </div>
  );
}
