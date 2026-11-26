import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Stat } from "@/components/ui";
import { dateTime, money, num } from "@/lib/format";

export const dynamic = "force-dynamic";

type M = {
  generated_at: string;
  login: { max_attempts: number; lock_minutes: number; failures_24h: number; successes_24h: number; blocked_accounts: number; blocked_ips: number };
  fraud: { open: number; open_high: number; new_24h: number; latest: { id: string; title: string; severity: string; created_at: string; tenant: string }[] };
  billing: { unpaid_invoices: number; unpaid_usd: number; overdue_invoices: number; past_due: number; expired: number;
    expiring_3d: { id: string; name: string; status: string; ends_at: string }[] };
  growth: { tenants_total: number; new_tenants_24h: number; new_users_24h: number; new_leads: number; tickets_open: number };
  messages: { failed_24h: number; not_configured_24h: number; queued_old: number };
  security_events_24h: number;
  cron: { last_run: string | null; failed_24h: number; ok_24h: number; last_error: string | null } | null;
};

type Alert = { level: "urgent" | "warn"; text: string; href?: string; action?: string };

function alerts(m: M): Alert[] {
  const a: Alert[] = [];
  if (m.login.blocked_ips > 0) a.push({ level: "urgent", text: `${m.login.blocked_ips} adresse(s) IP bloquée(s) : quelqu'un essaie de nombreux mots de passe (attaque possible).`, action: "Si cela se répète, activez le mode « Attack Challenge » dans Vercel → Firewall.", href: "https://vercel.com/ostapaul/ostapaul-manager/firewall" });
  if (m.fraud.open_high > 0) a.push({ level: "urgent", text: `${m.fraud.open_high} alerte(s) anti-fraude grave(s) non traitée(s).`, action: "Contactez l'établissement concerné et vérifiez l'opération.", href: "#fraude" });
  if (m.cron && m.cron.failed_24h > 0) a.push({ level: "urgent", text: `${m.cron.failed_24h} échec(s) des tâches automatiques (facturation, rappels) sur 24 h.`, action: "Transmettez le message d'erreur ci-dessous à votre développeur.", href: "#taches" });
  if (m.cron && (!m.cron.last_run || Date.now() - new Date(m.cron.last_run).getTime() > 3 * 3600_000)) a.push({ level: "urgent", text: "Les tâches automatiques n'ont pas tourné depuis plus de 3 heures.", action: "Vérifiez que le projet Supabase n'est pas en pause (offre gratuite).", href: "https://supabase.com/dashboard/project/ekleenngoavbwennfguu" });
  if (m.billing.overdue_invoices > 0) a.push({ level: "warn", text: `${m.billing.overdue_invoices} facture(s) d'abonnement en retard de paiement.`, action: "Relancez les établissements et encaissez en espèces.", href: "/admin/transactions" });
  if (m.login.blocked_accounts > 0) a.push({ level: "warn", text: `${m.login.blocked_accounts} compte(s) bloqué(s) après ${m.login.max_attempts} mots de passe faux.`, action: "Si un client vous appelle, il peut se débloquer avec « Mot de passe oublié ».", });
  if (m.fraud.open - m.fraud.open_high > 0) a.push({ level: "warn", text: `${m.fraud.open - m.fraud.open_high} alerte(s) anti-fraude à examiner.`, href: "#fraude" });
  if (m.billing.expiring_3d.length > 0) a.push({ level: "warn", text: `${m.billing.expiring_3d.length} essai(s) ou abonnement(s) se terminent dans les 3 jours.`, action: "Appelez ces clients pour le renouvellement.", href: "#expirations" });
  if (m.messages.failed_24h > 0 || m.messages.queued_old > 0) a.push({ level: "warn", text: `Messages SMS/WhatsApp : ${m.messages.failed_24h} échec(s), ${m.messages.queued_old} en attente depuis plus d'1 h.` });
  if (m.growth.new_leads > 0) a.push({ level: "warn", text: `${m.growth.new_leads} nouvelle(s) demande(s) de contact à rappeler.`, href: "/admin/leads" });
  if (m.growth.tickets_open > 0) a.push({ level: "warn", text: `${m.growth.tickets_open} demande(s) d'assistance ouverte(s).`, href: "/admin/tickets" });
  return a;
}

export default async function Monitoring() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_monitoring");
  if (error) return <div className="card text-red-600">Surveillance indisponible : {error.message}</div>;
  const m = data as M;
  const list = alerts(m);
  const urgent = list.filter((x) => x.level === "urgent");
  const verdict = urgent.length ? { cls: "border-red-300 bg-red-50 text-red-800", t: `🚨 Urgent : ${urgent.length} point(s) à traiter` }
    : list.length ? { cls: "border-amber-300 bg-amber-50 text-amber-900", t: `⚠️ À regarder : ${list.length} point(s)` }
    : { cls: "border-green-300 bg-green-50 text-green-800", t: "✅ Tout va bien" };
  const lockText = m.login.lock_minutes % 60 === 0 ? `${m.login.lock_minutes / 60} h` : `${m.login.lock_minutes} min`;

  return (
    <div>
      <PageHeader title="Surveillance" subtitle={<>État de la plateforme · mis à jour le {dateTime(m.generated_at)} · <Link href="/admin/monitoring" className="underline">Actualiser</Link></>} />

      <div className={`rounded-xl border p-4 text-lg font-bold ${verdict.cls}`}>{verdict.t}</div>
      {list.length > 0 && (
        <ul className="mt-3 space-y-2">
          {list.map((x, i) => (
            <li key={i} className={`card border-l-4 ${x.level === "urgent" ? "border-l-red-500" : "border-l-amber-400"}`}>
              <div className="font-semibold">{x.level === "urgent" ? "🚨" : "⚠️"} {x.text}</div>
              {(x.action || x.href) && (
                <div className="mt-1 text-sm text-slate-600">
                  {x.action} {x.href && <a href={x.href} className="font-semibold text-blue-700 underline" {...(x.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>Ouvrir →</a>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 mt-6 font-bold">🔐 Connexions (24 h)</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Connexions réussies" value={num(m.login.successes_24h)} tone="good" />
        <Stat label="Mots de passe faux" value={num(m.login.failures_24h)} />
        <Stat label="Comptes bloqués" value={num(m.login.blocked_accounts)} hint={`${m.login.max_attempts} essais puis ${lockText}`} tone={m.login.blocked_accounts ? "bad" : "default"} />
        <Stat label="Adresses IP bloquées" value={num(m.login.blocked_ips)} hint="20 échecs en 1 h" tone={m.login.blocked_ips ? "bad" : "default"} />
      </div>

      <h2 id="fraude" className="mb-2 mt-6 font-bold">🛡️ Anti-fraude</h2>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Alertes ouvertes" value={num(m.fraud.open)} tone={m.fraud.open ? "bad" : "default"} />
        <Stat label="Dont graves" value={num(m.fraud.open_high)} tone={m.fraud.open_high ? "bad" : "default"} />
        <Stat label="Nouvelles (24 h)" value={num(m.fraud.new_24h)} />
      </div>
      {m.fraud.latest.length > 0 && (
        <div className="card mt-3 space-y-1 text-sm">
          {m.fraud.latest.map((f) => <div key={f.id}><b>{f.tenant}</b> — {f.title} <span className="text-slate-500">({f.severity === "high" ? "grave" : f.severity === "medium" ? "moyenne" : "faible"}, {dateTime(f.created_at)})</span></div>)}
        </div>
      )}

      <h2 id="expirations" className="mb-2 mt-6 font-bold">💳 Abonnements</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Factures à encaisser" value={num(m.billing.unpaid_invoices)} hint={money(m.billing.unpaid_usd, "USD")} tone="gold" />
        <Stat label="Factures en retard" value={num(m.billing.overdue_invoices)} tone={m.billing.overdue_invoices ? "bad" : "default"} />
        <Stat label="Échéance dépassée" value={num(m.billing.past_due)} />
        <Stat label="Expirés (lecture seule)" value={num(m.billing.expired)} />
      </div>
      {m.billing.expiring_3d.length > 0 && (
        <div className="card mt-3 space-y-1 text-sm">
          <div className="font-semibold">Se terminent dans les 3 jours :</div>
          {m.billing.expiring_3d.map((t) => <div key={t.id}>{t.name} — {t.status === "trialing" ? "fin de l'essai" : "fin de l'abonnement"} le {dateTime(t.ends_at)}</div>)}
        </div>
      )}

      <h2 className="mb-2 mt-6 font-bold">📈 Activité</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Établissements" value={num(m.growth.tenants_total)} hint={`+${m.growth.new_tenants_24h} en 24 h`} />
        <Stat label="Nouveaux utilisateurs (24 h)" value={num(m.growth.new_users_24h)} />
        <Stat label="Demandes de contact" value={num(m.growth.new_leads)} hint="à rappeler" />
        <Stat label="Assistance ouverte" value={num(m.growth.tickets_open)} />
        <Stat label="Événements de sécurité (24 h)" value={num(m.security_events_24h)} />
      </div>

      <h2 id="taches" className="mb-2 mt-6 font-bold">⚙️ Tâches automatiques et messages</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Dernière exécution" value={m.cron?.last_run ? dateTime(m.cron.last_run) : m.cron ? "Jamais" : "Non disponible"} />
        <Stat label="Exécutions réussies (24 h)" value={num(m.cron?.ok_24h ?? 0)} tone="good" />
        <Stat label="Échecs (24 h)" value={num(m.cron?.failed_24h ?? 0)} tone={m.cron?.failed_24h ? "bad" : "default"} />
        <Stat label="SMS/WhatsApp non configurés (24 h)" value={num(m.messages.not_configured_24h)} hint="nécessite Twilio" />
      </div>
      {m.cron?.last_error && <div className="card mt-3 text-xs text-slate-600">Dernière erreur : <code>{m.cron.last_error}</code></div>}

      <div className="card mt-6 text-sm text-slate-600">
        <b>Pour aller plus loin :</b>{" "}
        <a className="underline" href="https://vercel.com/ostapaul/ostapaul-manager" target="_blank" rel="noreferrer">état du site et erreurs (Vercel)</a> ·{" "}
        <a className="underline" href="https://supabase.com/dashboard/project/ekleenngoavbwennfguu/advisors/security" target="_blank" rel="noreferrer">alertes de sécurité de la base (Supabase)</a>
      </div>
    </div>
  );
}
