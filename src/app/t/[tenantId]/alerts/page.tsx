import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader, Table } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { str } from "@/lib/server-actions";

const KIND: Record<string, string> = {
  duplicate_payment: "Doublon de paiement", unusual_amount: "Montant inhabituel", unusual_expense: "Dépense inhabituelle", suspicious_edit: "Modification suspecte",
  cash_difference: "Écart de caisse", unauthorized_access: "Accès non autorisé", large_discount: "Remise importante", stock_adjustment: "Ajustement de stock", amount_mismatch: "Montant opérateur différent",
};

async function resolve(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("fraud_alerts").update({ status: str(fd, "status") === "dismissed" ? "dismissed" : "resolved", resolved_at: new Date().toISOString(), resolved_by: user?.id })
    .eq("id", str(fd, "id")).eq("tenant_id", tenantId);
  redirect(`/t/${tenantId}/alerts`);
}

export default async function Alerts({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<{ all?: string }> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("audit.read")) return <Empty>Réservé à la direction.</Empty>;
  const supabase = await createClient();
  let aq = supabase.from("fraud_alerts").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(200);
  if (!q.all) aq = aq.eq("status", "open");
  const { data } = await aq;
  return (
    <div>
      <PageHeader title="🛡️ Moteur anti-fraude" subtitle="Opérations inhabituelles, modifications suspectes, écarts de caisse, doublons de paiement, tentatives d'accès non autorisées."
        actions={<a href={q.all ? "?" : "?all=1"} className="btn-ghost">{q.all ? "Alertes ouvertes" : "Historique complet"}</a>} />
      {data?.length ? (
        <Table head={["Date", "Gravité", "Type", "Détail", ""]}>
          {data.map((a) => (
            <tr key={a.id}>
              <td className="whitespace-nowrap">{dateTime(a.created_at)}</td>
              <td><span className={`badge ${a.severity === "high" ? "bg-red-100 text-red-700" : a.severity === "medium" ? "bg-amber-100 text-amber-700" : "bg-slate-100"}`}>{a.severity === "high" ? "⚠ Élevée" : a.severity === "medium" ? "Moyenne" : "Faible"}</span></td>
              <td className="font-medium">{KIND[a.kind] ?? a.kind}<div className="text-xs text-slate-500">{a.title}</div></td>
              <td className="max-w-md text-xs text-slate-600">{Object.entries(a.details ?? {}).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ")}</td>
              <td className="whitespace-nowrap">{a.status === "open" ? (
                <form action={resolve} className="flex gap-1"><input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="id" value={a.id} />
                  <button name="status" value="resolved" className="btn-ghost btn-sm">Traitée</button><button name="status" value="dismissed" className="btn-ghost btn-sm">Ignorer</button></form>
              ) : <span className="text-xs text-slate-400">{a.status === "resolved" ? "traitée" : "ignorée"}</span>}</td>
            </tr>
          ))}
        </Table>
      ) : <Empty>Aucune alerte {q.all ? "" : "ouverte"}. ✅</Empty>}
    </div>
  );
}
