import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { LocaleSwitch } from "@/components/site/LocaleSwitch";
import { NavLinks, type NavItem } from "./NavLinks";
import { logout } from "@/app/(auth)/actions";
import { spacesFor, type Session } from "@/lib/session";
import type { Dict, Locale } from "@/lib/i18n";

function spaceLabel(t: Dict, kind: string, label: string) {
  if (kind === "admin") return t.app.adminSpace;
  if (kind === "teacher") return t.app.teacherSpace;
  if (kind === "student") return t.app.studentSpace;
  return label;
}

export function AppShell({ t, locale, session, title, subtitle, nav, children, banner }:
  { t: Dict; locale: Locale; session: Session; title: string; subtitle?: string; nav: NavItem[]; children: ReactNode; banner?: ReactNode }) {
  const spaces = spacesFor(session);
  const sidebar = (
    <div className="flex h-full flex-col gap-6">
      <Link href="/" aria-label="AFRILEARN" className="px-2"><Logo dark size={32} /></Link>
      <div className="rounded-2xl bg-white/6 p-3 ring-1 ring-white/10">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gold-400">{subtitle}</p>
        <p className="mt-0.5 truncate font-display font-semibold text-white" title={title}>{title}</p>
      </div>
      <nav aria-label={title}><NavLinks items={nav} /></nav>
      {spaces.length > 1 && (
        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-white/40">{t.app.chooseSpace}</p>
          <ul className="space-y-1">
            {spaces.map((s) => (
              <li key={s.href}><Link href={s.href} className="block truncate rounded-lg px-3 py-1.5 text-sm text-white/60 hover:bg-white/8 hover:text-white">↳ {spaceLabel(t, s.kind, s.label)}</Link></li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto space-y-3 border-t border-white/10 pt-4">
        <Link href="/account" className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/8">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-gold-500 font-bold text-night-900">{session.profile.full_name.slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{session.profile.full_name}</span><span className="block truncate text-xs text-white/50">{session.profile.email}</span></span>
        </Link>
        <div className="flex items-center justify-between px-2">
          <LocaleSwitch locale={locale} dark />
          <form action={logout}><button className="text-sm font-medium text-white/60 hover:text-white">{t.common.logout}</button></form>
        </div>
      </div>
    </div>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[272px_1fr]">
      <aside className="sticky top-0 hidden h-screen overflow-y-auto bg-night-900 p-5 lg:block">{sidebar}</aside>
      <header className="sticky top-0 z-30 flex items-center justify-between bg-night-900 px-4 py-3 lg:hidden">
        <Link href="/" aria-label="AFRILEARN"><Logo dark size={28} /></Link>
        <details className="relative">
          <summary className="btn btn-ghost-dark btn-sm list-none [&::-webkit-details-marker]:hidden">{t.nav.menu}</summary>
          <div className="fixed inset-x-0 top-[56px] bottom-0 overflow-y-auto bg-night-900 p-5">{sidebar}</div>
        </details>
      </header>
      <main id="main" className="min-w-0 px-4 py-6 sm:px-8 sm:py-8">
        {banner}
        {children}
      </main>
    </div>
  );
}
