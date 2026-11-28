import Link from "next/link";
import { getResource } from "@/lib/resources";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Stat } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { money, num, todayISO } from "@/lib/format";
import { fillDays, forecast } from "@/lib/forecast";
import { SECTORS } from "@/lib/plans";

type Stats = Record<string, unknown> & {
  currency: string; revenue_today: number; revenue_month: number; expenses_month: number; pending_payments: number;
  low_stock: number; open_alerts: number; staff_present_today: number; employees: number;
  series: { d: string; r: number; e: number }[];
};

/** Analyse automatique à base de règles sur les données réelles (pas de texte inventé). */
function insights(s: Stats, sector: string) {
  const out: { tone: "risk" | "opportunity" | "info"; text: string }[] = [];
  const cur = s.currency;
  if (s.expenses_month > s.revenue_month && s.expenses_month > 0)
    out.push({ tone: "risk", text: `Dépenses du mois (${money(s.expenses_month, cur)}) supérieures aux recettes (${money(s.revenue_month, cur)}).` });
  if (s.low_stock > 0) out.push({ tone: "risk", text: `${s.low_stock} produit(s) sous le seuil d'alerte : réapprovisionnez pour éviter une rupture.` });
  if (s.open_alerts > 0) out.push({ tone: "risk", text: `${s.open_alerts} alerte(s) anti-fraude ouverte(s) à examiner.` });
  if (s.pending_payments > 0) out.push({ tone: "info", text: `${s.pending_payments} paiement(s) électronique(s) en attente de confirmation du prestataire.` });
  if (sector === "school") {
    const due = Number(s.fees_due ?? 0), paid = Number(s.fees_paid ?? 0), overdue = Number(s.fees_overdue ?? 0);
    if (due > 0) out.push({ tone: paid / due < 0.6 ? "risk" : "info", text: `Taux de recouvrement des frais : ${Math.round((paid / due) * 100)} %.` });
    if (overdue > 0) out.push({ tone: "risk", text: `${money(overdue, cur)} de frais échus non payés : envoyez des rappels aux parents.` });
  }
  if (sector === "restaurant") {
    const top = (s.top_items as { name: string; qty: number }[] | undefined)?.[0];
    if (top) out.push({ tone: "opportunity", text: `Article le plus vendu (30 j) : ${top.name} (${num(top.qty)} portions). Mettez-le en avant.` });
  }
  if (sector === "pme") {
    const rec = Number(s.receivables ?? 0);
    if (rec > 0) out.push({ tone: "risk", text: `Créances clients à encaisser : ${money(rec, cur)}.` });
    const top = (s.top_customers as { name: string; amount: number }[] | undefined)?.[0];
    if (top) out.push({ tone: "opportunity", text: `Premier client sur 90 jours : ${top.name} (${money(top.amount, cur)}).` });
  }
  const series = s.series ?? [];
  const last7 = series.slice(-7).reduce((a, p) => a + Number(p.r), 0);
  const prev7 = series.slice(-14, -7).reduce((a, p) => a + Number(p.r), 0);
  if (prev7 > 0) {
    const ch = (last7 - prev7) / prev7;
    out.push({ tone: ch >= 0 ? "opportunity" : "risk", text: `Recettes des 7 derniers jours : ${ch >= 0 ? "+" : ""}${Math.round(ch * 100)} % par rapport à la semaine précédente.` });
  }
  return out;
}

export default async function Dashboard({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const ctx = await getTenantContext(tenantId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_stats", { p_tenant: tenantId });
  const s = (data ?? {}) as Stats;
  const cur = s.currency ?? ctx.tenant.base_currency;
  const sector = SECTORS.find((x) => x.key === ctx.tenant.sector)!;
  const series = fillDays((s.series ?? []).map((p) => ({ d: p.d, v: Number(p.r) })), todayISO(-29), todayISO());
  const expMap = new Map((s.series ?? []).map((p) => [p.d.slice(0, 10), Number(p.e)]));
  const chart = series.map((p) => ({ label: p.d.slice(8, 10) + "/" + p.d.slice(5, 7), a: p.v, b: expMap.get(p.d) ?? 0 }));
  const fc = ctx.has("forecast") ? forecast(series, 30) : null;
  const tips = insights(s, ctx.tenant.sector);
  const p = `/t/${tenantId}`;

  // Démarrage rapide : listes encore vides que le client peut importer d'un coup
  const QUICK: Record<string, [string, string, string][]> = {
    restaurant: [["menu_items", "🍽️", "Votre menu"], ["products", "📦", "Vos produits en stock"], ["dining_tables", "🪑", "Vos tables"], ["employees", "🧑‍🍳", "Votre personnel"]],
    school: [["classes", "🏫", "Vos classes"], ["students", "🎓", "Vos élèves / étudiants"], ["teachers", "👩‍🏫", "Vos enseignants"], ["employees", "🧑‍💼", "Votre personnel"]],
    pme: [["products", "📦", "Vos produits"], ["customers", "🤝", "Vos clients"], ["suppliers", "🚚", "Vos fournisseurs"], ["employees", "🧑‍💼", "Votre personnel"]],
  };
  const quick = ctx.active ? (await Promise.all((QUICK[ctx.tenant.sector] ?? []).map(async ([key, icon, label]) => {
    const r = getResource(key);
    if (!r || !ctx.can(r.writePerm) || (r.feature && !ctx.has(r.feature))) return null;
    const { count } = await supabase.from(r.table).select("id", { count: "exact", head: true }).eq("tenant_id", tenantId);
    return count ? null : { key, icon, label };
  }))).filter((x): x is { key: string; icon: string; label: string } => !!x) : [];

  return (
    <div>
      <PageHeader title={`${sector.icon} ${ctx.tenant.name}`} subtitle={`${sector.label} · ${ctx.tenant.city ?? ""} · tableau de bord en temps réel`}
        actions={<>
          {ctx.has("ai") && ctx.can("ai.use") && <Link href={`${p}/ai`} className="btn-gold">✨ Assistant IA</Link>}
          {ctx.can("attendance.scan") && <Link href={`${p}/scanner`} className="btn-dark">📷 Scanner QR</Link>}
        </>} />
      {error && <div className="card mb-4 text-sm text-red-600">{error.message}</div>}
      {quick.length > 0 && (
        <div className="card mb-4 border-gold-300 bg-gradient-to-r from-amber-50 to-white">
          <h2 className="font-bold">🚀 Démarrage rapide : ajoutez vos listes en une seule fois</h2>
          <p className="mt-1 text-sm text-slate-600">Importez votre fichier Excel, collez votre tableau, ou saisissez plusieurs lignes d&apos;un coup — inutile d&apos;ajouter un par un.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {quick.map((q) => <Link key={q.key} href={`${p}/r/${q.key}/import`} className="btn-ghost bg-white">{q.icon} {q.label}</Link>)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Recettes aujourd'hui" value={money(s.revenue_today, cur)} />
        <Stat label="Recettes du mois" value={money(s.revenue_month, cur)} />
        <Stat label="Dépenses du mois" value={money(s.expenses_month, cur)} />
        <Stat label="Bénéfice du mois" value={money(Number(s.revenue_month ?? 0) - Number(s.expenses_month ?? 0), cur)}
          tone={Number(s.revenue_month ?? 0) >= Number(s.expenses_month ?? 0) ? "good" : "bad"} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ctx.tenant.sector === "restaurant" && <>
          <Stat label="Commandes en cours" value={num(s.open_orders as number)} hint={<Link className="text-electric-600" href={`${p}/restaurant/pos`}>Ouvrir la caisse →</Link>} />
          <Stat label="Commandes du jour" value={num(s.orders_today as number)} />
          <Stat label="Tables occupées" value={`${num(s.tables_occupied as number)} / ${num(s.tables_total as number)}`} />
          <Stat label="Personnel présent" value={`${num(s.staff_present_today)} / ${num(s.employees)}`} />
        </>}
        {ctx.tenant.sector === "school" && <>
          <Stat label="Élèves actifs" value={num(s.students as number)} hint={`${num(s.classes as number)} classe(s) · ${num(s.teachers as number)} enseignant(s)`} />
          <Stat label="Présents aujourd'hui" value={num(s.students_present_today as number)} />
          <Stat label="Frais encaissés" value={money(s.fees_paid as number, cur)} hint={`sur ${money(s.fees_due as number, cur)} facturés`} />
          <Stat label="Frais échus impayés" value={money(s.fees_overdue as number, cur)} tone={Number(s.fees_overdue) > 0 ? "bad" : "default"} />
        </>}
        {ctx.tenant.sector === "pme" && <>
          <Stat label="Ventes du mois" value={money(s.sales_month as number, cur)} />
          <Stat label="Créances clients" value={money(s.receivables as number, cur)} />
          <Stat label="Dettes fournisseurs" value={money(s.payables as number, cur)} />
          <Stat label="Devis en cours" value={num(s.quotes_open as number)} hint={`${num(s.customers as number)} client(s)`} />
        </>}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <h2 className="mb-3 font-bold">Recettes et dépenses — 30 derniers jours ({cur})</h2>
          <BarChart data={chart} currency={cur} seriesA="Recettes" seriesB="Dépenses" />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-slate-500">Voir le tableau des données</summary>
            <div className="mt-2 max-h-64 overflow-y-auto">
              <table className="tbl"><thead><tr><th>Jour</th><th>Recettes</th><th>Dépenses</th></tr></thead>
                <tbody>{chart.map((c) => <tr key={c.label}><td>{c.label}</td><td>{money(c.a, cur)}</td><td>{money(c.b, cur)}</td></tr>)}</tbody></table>
            </div>
          </details>
        </div>
        <div className="card">
          <h2 className="mb-3 font-bold">Analyse : risques & opportunités</h2>
          {tips.length ? (
            <ul className="space-y-2 text-sm">
              {tips.map((t, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden>{t.tone === "risk" ? "⚠️" : t.tone === "opportunity" ? "📈" : "ℹ️"}</span>
                  <span><span className="sr-only">{t.tone === "risk" ? "Risque : " : t.tone === "opportunity" ? "Opportunité : " : "Info : "}</span>{t.text}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">Pas encore assez de données pour une analyse.</p>}
          <p className="mt-3 text-xs text-slate-400">Calculé à partir de vos données enregistrées.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="card">
          <h2 className="mb-2 font-bold">🔮 Prévision des recettes (30 jours)</h2>
          {fc ? (
            <>
              <div className="text-2xl font-bold">{money(fc.total, cur)}</div>
              <p className="mt-1 text-sm text-slate-500">
                Tendance : {fc.trendPerDay >= 0 ? "+" : ""}{money(fc.trendPerDay, cur)} / jour
                {fc.changeVsRecent !== null && ` · ${fc.changeVsRecent >= 0 ? "+" : ""}${Math.round(fc.changeVsRecent * 100)} % vs 30 derniers jours`}
              </p>
              <p className="mt-2 text-xs text-slate-400">Modèle statistique (tendance linéaire × saisonnalité hebdomadaire). <Link href={`${p}/forecast`} className="text-electric-600">Détails</Link></p>
            </>
          ) : <p className="text-sm text-slate-500">Disponible avec la formule Premium. <Link className="text-electric-600" href={`${p}/subscription`}>Voir les formules</Link></p>}
        </div>
        {ctx.tenant.sector === "restaurant" && (
          <div className="card lg:col-span-2">
            <h2 className="mb-2 font-bold">Top articles (30 jours)</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {((s.top_items as { name: string; qty: number; amount: number }[]) ?? []).map((t) => (
                <li key={t.name} className="flex justify-between py-1.5"><span>{t.name}</span><span className="text-slate-500">{num(t.qty)} · {money(t.amount, cur)}</span></li>
              ))}
              {!((s.top_items as unknown[]) ?? []).length && <li className="py-2 text-slate-500">Aucune vente encore.</li>}
            </ul>
          </div>
        )}
        {ctx.tenant.sector === "pme" && (
          <div className="card lg:col-span-2">
            <h2 className="mb-2 font-bold">Meilleurs clients (90 jours)</h2>
            <ul className="divide-y divide-slate-100 text-sm">
              {((s.top_customers as { name: string; amount: number }[]) ?? []).map((t) => (
                <li key={t.name} className="flex justify-between py-1.5"><span>{t.name}</span><span className="text-slate-500">{money(t.amount, cur)}</span></li>
              ))}
              {!((s.top_customers as unknown[]) ?? []).length && <li className="py-2 text-slate-500">Aucune facture émise encore.</li>}
            </ul>
          </div>
        )}
        {ctx.tenant.sector === "school" && (
          <div className="card lg:col-span-2">
            <h2 className="mb-2 font-bold">Raccourcis</h2>
            <div className="flex flex-wrap gap-2">
              <Link href={`${p}/r/students?new=1`} className="btn-ghost">+ Inscrire un élève</Link>
              <Link href={`${p}/school/grades`} className="btn-ghost">✍️ Saisir des notes</Link>
              <Link href={`${p}/school/invoices`} className="btn-ghost">💳 Encaisser des frais</Link>
              <Link href={`${p}/school/rollcall`} className="btn-ghost">✅ Faire l&apos;appel</Link>
              <Link href={`${p}/cards?type=student`} className="btn-ghost">🪪 Cartes élèves</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
