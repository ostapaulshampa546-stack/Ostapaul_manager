import Link from "next/link";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader, Stat, Table } from "@/components/ui";
import { BarChart } from "@/components/charts";
import { PrintButton } from "@/components/PrintButton";
import { date, money, todayISO } from "@/lib/format";

const GRAN = { day: "Journalier", week: "Hebdomadaire", month: "Mensuel", year: "Annuel" } as const;
type Row = { period: string; revenue: number; expenses: number; profit: number };

export default async function Finance({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("finance.read")) return <Empty>Accès réservé à la comptabilité et à la direction.</Empty>;
  const g = (Object.keys(GRAN).includes(q.g ?? "") ? q.g : "day") as keyof typeof GRAN;
  const defaultFrom = g === "day" ? todayISO(-29) : g === "week" ? todayISO(-83) : g === "month" ? todayISO(-364) : todayISO(-365 * 5);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(q.from ?? "") ? q.from! : defaultFrom;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(q.to ?? "") ? q.to! : todayISO();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finance_report", { p_tenant: tenantId, p_from: from, p_to: to, p_granularity: g });
  const rows = (data ?? []) as Row[];
  const cur = ctx.tenant.base_currency;
  const tot = rows.reduce((a, r) => ({ r: a.r + Number(r.revenue), e: a.e + Number(r.expenses) }), { r: 0, e: 0 });
  const label = (d: string) => g === "year" ? d.slice(0, 4) : g === "month" ? d.slice(5, 7) + "/" + d.slice(0, 4) : d.slice(8, 10) + "/" + d.slice(5, 7);
  const qs = (o: Record<string, string>) => new URLSearchParams({ g, from, to, ...o }).toString();

  return (
    <div>
      <PageHeader title="Finances & rapports" subtitle={`Recettes (encaissements confirmés + recettes diverses), dépenses et bénéfices · montants consolidés en ${cur} (1 USD = ${ctx.tenant.cdf_per_usd} CDF)`}
        actions={<>
          {ctx.has("export") && <a className="btn-ghost" href={`/api/export/finance?tenant=${tenantId}&${qs({})}`}>⬇️ Excel (CSV)</a>}
          {ctx.has("export") && <PrintButton label="PDF / Imprimer" />}
        </>} />
      <Flash error={error?.message} />
      <form className="no-print card mb-4 flex flex-wrap items-end gap-3">
        <div><label className="label">Rapport</label>
          <select name="g" defaultValue={g} className="input">{Object.entries(GRAN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div><label className="label">Du</label><input type="date" name="from" defaultValue={from} className="input" /></div>
        <div><label className="label">Au</label><input type="date" name="to" defaultValue={to} className="input" /></div>
        <button className="btn-primary">Générer</button>
        <div className="flex gap-1 text-xs">
          <Link className="btn-ghost btn-sm" href={`?${new URLSearchParams({ g: "day", from: todayISO(), to: todayISO() })}`}>Aujourd&apos;hui</Link>
          <Link className="btn-ghost btn-sm" href={`?${new URLSearchParams({ g: "day", from: todayISO(-6), to: todayISO() })}`}>7 jours</Link>
          <Link className="btn-ghost btn-sm" href={`?${new URLSearchParams({ g: "month", from: todayISO().slice(0, 4) + "-01-01", to: todayISO() })}`}>Cette année</Link>
        </div>
      </form>
      {!ctx.has("reports_detailed") && <p className="mb-4 text-xs text-slate-500">Formule Basique : rapports journaliers sur 31 jours maximum. Hebdomadaires, mensuels et annuels à partir de Standard.</p>}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Recettes" value={money(tot.r, cur)} />
        <Stat label="Dépenses" value={money(tot.e, cur)} />
        <Stat label="Bénéfice" value={money(tot.r - tot.e, cur)} tone={tot.r >= tot.e ? "good" : "bad"} />
      </div>
      {rows.length ? (
        <>
          <div className="card mb-4"><BarChart data={rows.map((r) => ({ label: label(r.period), a: Number(r.revenue), b: Number(r.expenses) }))} currency={cur} seriesB="Dépenses" /></div>
          <Table head={["Période", "Recettes", "Dépenses", "Bénéfice"]}>
            {rows.map((r) => (
              <tr key={r.period}><td>{g === "day" ? date(r.period) : label(r.period)}</td><td>{money(r.revenue, cur)}</td><td>{money(r.expenses, cur)}</td>
                <td className={Number(r.profit) >= 0 ? "text-emerald-700" : "text-red-600"}>{money(r.profit, cur)}</td></tr>
            ))}
          </Table>
        </>
      ) : <Empty>Aucune opération sur la période.</Empty>}
    </div>
  );
}
