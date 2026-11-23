import Link from "next/link";
import { getTenantContext } from "@/lib/context";
import { navFor } from "@/lib/nav";
import { SECTORS, TIER_LABEL } from "@/lib/plans";
import { getT, getLocale } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { dateTime } from "@/lib/format";
import { setLocale } from "./actions";
import { VoiceButton } from "@/components/VoiceButton";

export default async function TenantLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const ctx = await getTenantContext(tenantId);
  const t = await getT();
  const locale = await getLocale();
  const sector = SECTORS.find((s) => s.key === ctx.tenant.sector)!;
  const items = navFor(ctx.tenant.sector, tenantId).filter((i) => !i.perm || ctx.can(i.perm));
  const groups = Array.from(new Set(items.map((i) => i.group)));
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).is("read_at", null);
  const sub = ctx.subscription;
  const accent = ctx.has("workspace_custom") && ctx.tenant.brand_color ? ctx.tenant.brand_color : sector.accent;

  const nav = (
    <nav className="space-y-5">
      {groups.map((g) => (
        <div key={g}>
          <div className="px-3 text-[10px] font-bold uppercase tracking-widest text-white/40">{g}</div>
          <ul className="mt-1 space-y-0.5">
            {items.filter((i) => i.group === g).map((i) => {
              const locked = i.feature && !ctx.has(i.feature);
              return (
                <li key={i.href}>
                  <Link href={i.href} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 hover:text-white">
                    <span aria-hidden>{i.icon}</span><span className="flex-1">{t(i.label)}</span>
                    {locked && <span className="text-[10px] text-gold-400" title="Formule supérieure requise">🔒</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen md:flex" style={{ ["--accent" as string]: accent }}>
      <aside className="no-print hidden w-64 shrink-0 flex-col bg-navy-900 p-4 md:flex md:min-h-screen">
        <Logo dark href="/app" />
        <div className="mt-5 rounded-xl bg-white/5 p-3">
          <div className="text-xs text-white/50">{sector.icon} {sector.label}</div>
          <div className="truncate font-semibold text-white">{ctx.tenant.name}</div>
          <div className="mt-1 h-1 w-12 rounded" style={{ background: accent }} />
        </div>
        <div className="mt-5 flex-1 overflow-y-auto">{nav}</div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="no-print sticky top-0 z-20 flex items-center gap-2 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur">
          <details className="md:hidden">
            <summary className="btn-ghost btn-sm list-none">☰ Menu</summary>
            <div className="absolute left-0 right-0 top-full max-h-[80vh] overflow-y-auto bg-navy-900 p-4 shadow-xl">{nav}</div>
          </details>
          <div className="min-w-0 flex-1 truncate text-sm font-semibold md:hidden">{ctx.tenant.name}</div>
          <div className="hidden flex-1 md:block" />
          <span className="badge hidden bg-gold-100 text-navy-900 sm:inline-flex">{TIER_LABEL[ctx.tier]}</span>
          {ctx.has("voice") && ctx.can("ai.use") && <VoiceButton tenantId={tenantId} />}
          <form action={setLocale}>
            <input type="hidden" name="locale" value={locale === "fr" ? "ln" : "fr"} />
            <input type="hidden" name="back" value={`/t/${tenantId}`} />
            <button className="btn-ghost btn-sm" title="Langue">{locale === "fr" ? "FR → LN" : "LN → FR"}</button>
          </form>
          <Link href={`/t/${tenantId}/notifications`} className="btn-ghost btn-sm relative" aria-label="Notifications">
            🔔{count ? <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white">{count}</span> : null}
          </Link>
          <form action="/auth/signout" method="post"><button className="btn-ghost btn-sm">{t("Déconnexion")}</button></form>
        </header>

        {ctx.tenant.status === "suspended" && (
          <div className="no-print bg-red-600 px-4 py-2 text-sm text-white">Compte suspendu par l&apos;administrateur de la plateforme{ctx.tenant.suspended_reason ? ` : ${ctx.tenant.suspended_reason}` : ""}. Consultation seule.</div>
        )}
        {ctx.tenant.status === "active" && sub?.status === "trialing" && (
          <div className="no-print bg-electric-600 px-4 py-2 text-sm text-white">
            Essai gratuit jusqu&apos;au {dateTime(sub.trial_ends_at)}. <Link href={`/t/${tenantId}/subscription`} className="font-bold underline">Souscrire maintenant</Link>
          </div>
        )}
        {ctx.tenant.status === "active" && !ctx.active && (
          <div className="no-print bg-gold-500 px-4 py-2 text-sm font-medium text-navy-950">
            Abonnement inactif : vos données restent consultables, les modifications sont bloquées. <Link href={`/t/${tenantId}/subscription`} className="font-bold underline">Renouveler</Link>
          </div>
        )}
        <main className="mx-auto max-w-7xl p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
