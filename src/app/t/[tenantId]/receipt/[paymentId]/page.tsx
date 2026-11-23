import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { dateTime, METHOD_LABELS, money, STATUS_LABELS } from "@/lib/format";
import { qrSvg, receiptUrl } from "@/lib/qr";

const PAYABLE: Record<string, string> = { order: "Commande restaurant", student_invoice: "Frais scolaires", sales_document: "Facture", subscription_invoice: "Abonnement", other: "Divers" };

export default async function Receipt({ params }: { params: Promise<{ tenantId: string; paymentId: string }> }) {
  const { tenantId, paymentId } = await params;
  const ctx = await getTenantContext(tenantId);
  const supabase = await createClient();
  const { data: p } = await supabase.from("payments").select("*").eq("id", paymentId).eq("tenant_id", tenantId).maybeSingle();
  if (!p) notFound();
  let detail = "";
  if (p.payable_type === "student_invoice") {
    const { data } = await supabase.from("student_invoices").select("description, net_amount, paid_amount, currency, students(first_name, post_name, last_name, matricule)").eq("id", p.payable_id).maybeSingle();
    const s = data?.students as unknown as { first_name: string; post_name: string | null; last_name: string; matricule: string } | undefined;
    if (data) detail = `${data.description} — ${s?.last_name} ${s?.post_name ?? ""} ${s?.first_name} (${s?.matricule}) · reste ${money(Number(data.net_amount) - Number(data.paid_amount), data.currency)}`;
  } else if (p.payable_type === "sales_document") {
    const { data } = await supabase.from("sales_documents").select("number, total, paid_amount, currency, customers(name)").eq("id", p.payable_id).maybeSingle();
    if (data) detail = `Facture ${data.number} — ${(data.customers as unknown as { name: string } | null)?.name ?? ""} · reste ${money(Number(data.total) - Number(data.paid_amount), data.currency)}`;
  } else if (p.payable_type === "order") {
    const { data } = await supabase.from("orders").select("number").eq("id", p.payable_id).maybeSingle();
    if (data) detail = `Commande #${data.number}`;
  }
  const svg = await qrSvg(receiptUrl(p.receipt_token));
  return (
    <div>
      <div className="no-print mb-4"><PrintButton label="Imprimer le reçu" /></div>
      <div className="print-area mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div><div className="text-lg font-bold">{ctx.tenant.name}</div><div className="text-xs text-slate-500">{ctx.tenant.address} {ctx.tenant.city} {ctx.tenant.phone}</div></div>
          <div className="text-right text-xs"><div className="font-bold uppercase text-gold-500">Reçu</div><div className="font-mono">{p.receipt_number ?? "—"}</div></div>
        </div>
        <div className="my-4 h-px bg-slate-200" />
        <div className="text-center text-3xl font-extrabold">{money(p.amount, p.currency)}</div>
        <div className="text-center text-sm text-slate-500">{STATUS_LABELS[p.status]} · {METHOD_LABELS[p.method]}</div>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Objet</dt><dd>{PAYABLE[p.payable_type]}</dd></div>
          {detail && <div className="text-xs text-slate-600">{detail}</div>}
          <div className="flex justify-between"><dt className="text-slate-500">Référence</dt><dd className="font-mono text-xs">{p.reference}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Date</dt><dd>{dateTime(p.paid_at ?? p.created_at)}</dd></div>
          {p.payer_name && <div className="flex justify-between"><dt className="text-slate-500">Payeur</dt><dd>{p.payer_name}</dd></div>}
          {p.provider_ref && <div className="flex justify-between"><dt className="text-slate-500">Réf. opérateur</dt><dd className="font-mono text-xs">{p.provider_ref}</dd></div>}
        </dl>
        <div className="mx-auto mt-4 w-28" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-center text-[10px] text-slate-400">Scannez pour vérifier l&apos;authenticité de ce reçu</p>
      </div>
    </div>
  );
}
