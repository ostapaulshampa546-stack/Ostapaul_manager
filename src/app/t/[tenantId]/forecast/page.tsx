import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Locked, PageHeader, Stat, Table } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { money, num, todayISO } from "@/lib/format";
import { fillDays, forecast } from "@/lib/forecast";

export default async function Forecast({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.has("forecast")) return <Locked feature="Tableau de bord prédictif" tenantId={tenantId} tierLabel="Premium" />;
  const supabase = await createClient();
  const from = todayISO(-89), to = todayISO();
  const [{ data: rows }, { data: stock }] = await Promise.all([
    supabase.rpc("finance_report", { p_tenant: tenantId, p_from: from, p_to: to, p_granularity: "day" }),
    ctx.tenant.sector !== "school" ? supabase.rpc("stock_forecast", { p_tenant: tenantId }) : Promise.resolve({ data: [] }),
  ]);
  const r = (rows ?? []) as { period: string; revenue: number; expenses: number }[];
  const rev = fillDays(r.map((x) => ({ d: x.period, v: Number(x.revenue) })), from, to);
  const exp = fillDays(r.map((x) => ({ d: x.period, v: Number(x.expenses) })), from, to);
  const fr = forecast(rev, 30), fe = forecast(exp, 30);
  const cur = ctx.tenant.base_currency;
  const enough = rev.filter((p) => p.v > 0).length >= 14;
  const risky = ((stock ?? []) as { name: string; days_left: number | null; qty_on_hand: number; unit: string; avg_daily_out: number }[]).filter((s) => s.days_left !== null && s.days_left <= 14);
  return (
    <div>
      <PageHeader title="🔮 Tableau de bord prédictif" subtitle="Projection sur 30 jours à partir des 90 derniers jours (tendance linéaire × saisonnalité hebdomadaire). Indicatif, à confronter à votre connaissance du terrain." />
      {!enough && <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Moins de 14 jours d&apos;activité enregistrée : la prévision est peu fiable.</p>}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Recettes prévues (30 j)" value={money(fr.total, cur)} hint={fr.changeVsRecent !== null ? `${fr.changeVsRecent >= 0 ? "+" : ""}${Math.round(fr.changeVsRecent * 100)} % vs 30 derniers jours` : undefined} />
        <Stat label="Dépenses prévues (30 j)" value={money(fe.total, cur)} />
        <Stat label="Résultat prévu" value={money(fr.total - fe.total, cur)} tone={fr.total >= fe.total ? "good" : "bad"} />
        <Stat label="Produits à risque de rupture (≤ 14 j)" value={risky.length} tone={risky.length ? "bad" : "good"} />
      </div>
      <div className="card mb-4"><h2 className="mb-2 font-bold">Projection quotidienne</h2>
        <BarChart data={fr.points.map((p, i) => ({ label: p.d.slice(8, 10) + "/" + p.d.slice(5, 7), a: p.v, b: fe.points[i].v }))} currency={cur} seriesA="Recettes prévues" seriesB="Dépenses prévues" /></div>
      {risky.length > 0 && (
        <Table head={["Produit", "Stock", "Consommation / jour", "Rupture estimée"]}>
          {risky.map((s) => <tr key={s.name}><td>{s.name}</td><td>{num(s.qty_on_hand, 2)} {s.unit}</td><td>{num(s.avg_daily_out, 2)}</td><td className="font-bold text-red-600">{num(s.days_left, 1)} jours</td></tr>)}
        </Table>
      )}
    </div>
  );
}
