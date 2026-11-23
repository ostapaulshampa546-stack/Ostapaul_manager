import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader, StatusBadge, Table, sp } from "@/components/ui";
import { date, money } from "@/lib/format";
import { failIfError, str, withParam } from "@/lib/server-actions";

async function generate(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant");
  const back = `/t/${tenantId}/school/invoices`;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_fee_invoices", { p_fee_type: str(fd, "fee_type") });
  await failIfError(supabase, tenantId, error, "generate_fee_invoices", back);
  redirect(withParam(back, "success", `${data} facture(s) créée(s) (bourses déduites, doublons ignorés).`));
}

export default async function SchoolInvoices({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("fees.read")) return <Empty>Accès réservé.</Empty>;
  const supabase = await createClient();
  let iq = supabase.from("student_invoices").select("*, students!inner(first_name, post_name, last_name, matricule, class_id)").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(300);
  if (q.status) iq = iq.eq("status", q.status);
  if (q.class) iq = iq.eq("students.class_id", q.class);
  if (q.q) iq = iq.or(`last_name.ilike.%${q.q.replace(/[%,()*]/g, "")}%,matricule.ilike.%${q.q.replace(/[%,()*]/g, "")}%`, { referencedTable: "students" });
  const [{ data: invoices }, { data: fees }, { data: classes }] = await Promise.all([
    iq,
    supabase.from("fee_types").select("id, name, amount, currency").eq("tenant_id", tenantId).order("created_at", { ascending: false }),
    supabase.from("classes").select("id, name").eq("tenant_id", tenantId).order("name"),
  ]);
  return (
    <div>
      <PageHeader title="Frais scolaires : factures & paiements" subtitle="Encaissez les frais en espèces ou par Mobile Money ; les parents peuvent recevoir les reçus par SMS/WhatsApp (Premium)." />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      {ctx.can("fees.write") && ctx.active && (
        <form action={generate} className="card mb-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="tenant" value={tenantId} />
          <div className="flex-1"><label className="label">Générer les factures pour</label>
            <select name="fee_type" className="input">{(fees ?? []).map((f) => <option key={f.id} value={f.id}>{f.name} — {money(f.amount, f.currency)}</option>)}</select></div>
          <button className="btn-primary" disabled={!fees?.length}>Générer</button>
          <Link href={`/t/${tenantId}/r/fee_types?new=1`} className="btn-ghost">+ Type de frais</Link>
        </form>
      )}
      <form className="no-print mb-3 flex flex-wrap gap-2">
        <input name="q" defaultValue={q.q} placeholder="Nom ou matricule" className="input w-48" />
        <select name="class" defaultValue={q.class ?? ""} className="input w-auto"><option value="">Toutes classes</option>{(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select name="status" defaultValue={q.status ?? ""} className="input w-auto"><option value="">Tous</option><option value="unpaid">Impayées</option><option value="partial">Partielles</option><option value="paid">Payées</option></select>
        <button className="btn-ghost">Filtrer</button>
      </form>
      {invoices?.length ? (
        <Table head={["Élève", "Frais", "Net", "Payé", "Reste", "Échéance", "Statut", ""]}>
          {invoices.map((i) => {
            const s = i.students as { first_name: string; post_name: string | null; last_name: string; matricule: string };
            return (
              <tr key={i.id}>
                <td><div className="font-medium">{s.last_name} {s.post_name ?? ""} {s.first_name}</div><div className="font-mono text-xs text-slate-400">{s.matricule}</div></td>
                <td>{i.description}{Number(i.discount) > 0 && <div className="text-xs text-emerald-700">Bourse −{money(i.discount, i.currency)}</div>}</td>
                <td>{money(i.net_amount, i.currency)}</td><td>{money(i.paid_amount, i.currency)}</td>
                <td className="font-semibold">{money(Number(i.net_amount) - Number(i.paid_amount), i.currency)}</td>
                <td className={i.due_date && i.due_date < new Date().toISOString().slice(0, 10) && i.status !== "paid" ? "text-red-600" : ""}>{date(i.due_date)}</td>
                <td><StatusBadge status={i.status} /></td>
                <td><Link href={`/t/${tenantId}/school/invoices/${i.id}`} className="btn-primary btn-sm">{i.status === "paid" ? "Voir" : "Encaisser"}</Link></td>
              </tr>
            );
          })}
        </Table>
      ) : <Empty>Aucune facture.</Empty>}
    </div>
  );
}
