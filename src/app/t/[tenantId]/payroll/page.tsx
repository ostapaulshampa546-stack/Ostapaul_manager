import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, Locked, PageHeader, StatusBadge, Table, sp } from "@/components/ui";
import { money } from "@/lib/format";
import { failIfError, numOrNull, str, withParam } from "@/lib/server-actions";

async function generate(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"); const period = str(fd, "period");
  const back = `/t/${tenantId}/payroll?period=${period}`;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_payslips", { p_tenant: tenantId, p_period: `${period}-01` });
  await failIfError(supabase, tenantId, error, "generate_payslips", back);
  redirect(withParam(back, "success", `${data} fiche(s) de paie créée(s).`));
}
async function update(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"); const back = str(fd, "back");
  const supabase = await createClient();
  const { error } = await supabase.from("payslips").update({ bonuses: numOrNull(fd, "bonuses") ?? 0, deductions: numOrNull(fd, "deductions") ?? 0 })
    .eq("id", str(fd, "id")).eq("tenant_id", tenantId).eq("status", "draft");
  await failIfError(supabase, tenantId, error, "update:payslips", back);
  redirect(back);
}
async function pay(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"); const back = str(fd, "back");
  const supabase = await createClient();
  const { error } = await supabase.rpc("pay_payslip", { p_payslip: str(fd, "id") });
  await failIfError(supabase, tenantId, error, "pay_payslip", back);
  redirect(withParam(back, "success", "Salaire payé et enregistré en dépense."));
}

export default async function Payroll({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.has("staff")) return <Locked feature="Salaires et paie" tenantId={tenantId} tierLabel="Standard" />;
  const period = /^\d{4}-\d{2}$/.test(q.period ?? "") ? q.period! : new Date().toISOString().slice(0, 7);
  const supabase = await createClient();
  const { data: slips } = await supabase.from("payslips").select("*, employees(first_name, last_name, position)").eq("tenant_id", tenantId).eq("period", `${period}-01`).order("created_at");
  const back = `/t/${tenantId}/payroll?period=${period}`;
  const can = ctx.can("hr.write") && ctx.active;
  return (
    <div>
      <PageHeader title="Salaires" subtitle="Fiches de paie générées depuis le salaire de base et les présences pointées." />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <form className="flex gap-2"><input type="month" name="period" defaultValue={period} className="input w-auto" /><button className="btn-ghost">Afficher</button></form>
        {can && <form action={generate}><input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="period" value={period} /><button className="btn-primary">Générer les fiches du mois</button></form>}
      </div>
      {slips?.length ? (
        <Table head={["Employé", "Jours présents", "Base", "Primes", "Retenues", "Net", "Statut", ""]}>
          {slips.map((s) => {
            const e = s.employees as { first_name: string; last_name: string; position: string | null };
            return (
              <tr key={s.id}>
                <td className="font-medium">{e.first_name} {e.last_name}<div className="text-xs text-slate-400">{e.position}</div></td>
                <td>{s.days_present ?? "—"}</td><td>{money(s.base_salary, s.currency)}</td>
                <td colSpan={2}>{s.status === "draft" && can ? (
                  <form action={update} className="flex gap-1"><input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="id" value={s.id} /><input type="hidden" name="back" value={back} />
                    <input name="bonuses" type="number" step="0.01" defaultValue={s.bonuses} className="input w-24 py-1" />
                    <input name="deductions" type="number" step="0.01" defaultValue={s.deductions} className="input w-24 py-1" />
                    <button className="btn-ghost btn-sm">OK</button></form>
                ) : `${money(s.bonuses, s.currency)} / ${money(s.deductions, s.currency)}`}</td>
                <td className="font-bold">{money(s.net_salary, s.currency)}</td><td><StatusBadge status={s.status} /></td>
                <td>{s.status === "draft" && can && ctx.can("finance.write") && (
                  <form action={pay}><input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="id" value={s.id} /><input type="hidden" name="back" value={back} /><button className="btn-primary btn-sm">Payer</button></form>
                )}</td>
              </tr>
            );
          })}
        </Table>
      ) : <Empty>Aucune fiche pour {period}. Cliquez sur « Générer les fiches du mois ».</Empty>}
    </div>
  );
}
