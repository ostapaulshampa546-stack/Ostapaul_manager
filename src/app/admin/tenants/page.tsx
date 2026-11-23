import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Flash, PageHeader, StatusBadge, Table, sp } from "@/components/ui";
import { date, dateTime, money } from "@/lib/format";
import { str, withParam } from "@/lib/server-actions";

async function setStatus(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_tenant_status", { p_tenant: str(fd, "id"), p_status: str(fd, "status"), p_reason: str(fd, "reason") || null });
  redirect(withParam("/admin/tenants", error ? "error" : "success", error?.message ?? "Statut mis à jour."));
}
async function grant(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_grant_days", { p_tenant: str(fd, "id"), p_days: Number(str(fd, "days")) });
  redirect(withParam("/admin/tenants", error ? "error" : "success", error?.message ?? "Jours offerts."));
}
async function cash(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: inv } = await supabase.from("subscription_invoices").select("id").eq("tenant_id", str(fd, "id")).eq("status", "unpaid").order("created_at", { ascending: false }).limit(1).maybeSingle();
  let invoiceId = inv?.id;
  if (!invoiceId) {
    const { data, error } = await supabase.rpc("create_renewal_invoice", { p_tenant: str(fd, "id") });
    if (error) redirect(withParam("/admin/tenants", "error", error.message));
    invoiceId = (data as { id: string }).id;
  }
  const { error } = await supabase.rpc("admin_record_subscription_cash", { p_invoice: invoiceId, p_payer: str(fd, "payer") || null });
  redirect(withParam("/admin/tenants", error ? "error" : "success", error?.message ?? "Paiement en espèces enregistré : abonnement activé."));
}

export default async function Tenants({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const supabase = await createClient();
  let tq = supabase.from("tenants").select("id, name, sector, city, phone, status, created_at, parent_id, subscriptions(status, trial_ends_at, current_period_end, plans(name, price_usd))").order("created_at", { ascending: false }).limit(300);
  if (q.q) tq = tq.ilike("name", `%${q.q.replace(/[%,()*]/g, "")}%`);
  if (q.sector) tq = tq.eq("sector", q.sector);
  const { data } = await tq;
  return (
    <div>
      <PageHeader title="Établissements inscrits" />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <form className="mb-3 flex flex-wrap gap-2"><input name="q" defaultValue={q.q} placeholder="Nom" className="input w-48" />
        <select name="sector" defaultValue={q.sector ?? ""} className="input w-auto"><option value="">Tous secteurs</option><option value="restaurant">Restaurant</option><option value="school">École</option><option value="pme">PME</option></select>
        <button className="btn-ghost">Filtrer</button></form>
      <Table head={["Établissement", "Abonnement", "Échéance", "Statut", "Actions"]}>
        {(data ?? []).map((t) => {
          const s = (t.subscriptions as unknown as { status: string; trial_ends_at: string | null; current_period_end: string | null; plans: { name: string; price_usd: number } }[] | null)?.[0];
          return (
            <tr key={t.id}>
              <td><div className="font-medium">{t.name}</div><div className="text-xs text-slate-500">{t.sector} · {t.city} · {t.phone ?? ""} · inscrit le {date(t.created_at)}{t.parent_id ? " · succursale" : ""}</div></td>
              <td>{s ? <><StatusBadge status={s.status} /> <span className="text-xs">{s.plans.name} · {money(s.plans.price_usd, "USD")}</span></> : "—"}</td>
              <td className="text-xs">{dateTime(s?.status === "trialing" ? s.trial_ends_at : s?.current_period_end)}</td>
              <td><StatusBadge status={t.status} /></td>
              <td className="space-y-1">
                <form action={setStatus} className="flex gap-1"><input type="hidden" name="id" value={t.id} />
                  {t.status === "active" ? <><input name="reason" placeholder="Motif" className="input w-28 py-1 text-xs" /><button name="status" value="suspended" className="btn-danger btn-sm">Suspendre</button></>
                    : <button name="status" value="active" className="btn-primary btn-sm">Réactiver</button>}</form>
                {!t.parent_id && <>
                  <form action={grant} className="flex gap-1"><input type="hidden" name="id" value={t.id} /><input name="days" type="number" min={1} max={365} defaultValue={30} className="input w-16 py-1 text-xs" /><button className="btn-ghost btn-sm">Offrir des jours</button></form>
                  <form action={cash} className="flex gap-1"><input type="hidden" name="id" value={t.id} /><input name="payer" placeholder="Payeur" className="input w-28 py-1 text-xs" /><button className="btn-gold btn-sm">Encaisser espèces</button></form>
                </>}
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
