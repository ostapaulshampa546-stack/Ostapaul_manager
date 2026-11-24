import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LocaleSwitch } from "./LocaleSwitch";
import type { Dict, Locale } from "@/lib/i18n";

export function siteNav(t: Dict) {
  return [
    { href: "/features", label: t.nav.features },
    { href: "/ai-teacher", label: t.nav.aiTeacher },
    { href: "/courses", label: t.nav.courses },
    { href: "/centers", label: t.nav.centers },
    { href: "/students", label: t.nav.students },
    { href: "/pricing", label: t.nav.pricing },
    { href: "/contact", label: t.nav.contact },
  ];
}

export function SiteHeader({ t, locale, loggedIn }: { t: Dict; locale: Locale; loggedIn: boolean }) {
  const nav = siteNav(t);
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" aria-label="AFRILEARN"><Logo dark /></Link>
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white">{n.label}</Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          <LocaleSwitch locale={locale} dark />
          {loggedIn ? (
            <Link href="/app" className="btn btn-gold btn-sm">{t.common.openApp}</Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost-dark btn-sm">{t.common.login}</Link>
              <Link href="/register" className="btn btn-gold btn-sm">{t.common.register}</Link>
            </>
          )}
        </div>
        <details className="group relative lg:hidden">
          <summary className="btn btn-ghost-dark btn-sm cursor-pointer list-none [&::-webkit-details-marker]:hidden" aria-label={t.nav.menu}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </summary>
          <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-night-900/95 p-3 shadow-2xl ring-1 ring-white/10 backdrop-blur">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} className="block rounded-lg px-3 py-2.5 font-medium text-white/85 hover:bg-white/10">{n.label}</Link>
            ))}
            <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
              <LocaleSwitch locale={locale} dark />
              {loggedIn ? <Link href="/app" className="btn btn-gold btn-sm">{t.common.openApp}</Link> : (
                <div className="flex gap-2">
                  <Link href="/login" className="btn btn-ghost-dark btn-sm">{t.common.login}</Link>
                  <Link href="/register" className="btn btn-gold btn-sm">{t.common.register}</Link>
                </div>
              )}
            </div>
          </div>
        </details>
      </div>
    </header>
  );
}
