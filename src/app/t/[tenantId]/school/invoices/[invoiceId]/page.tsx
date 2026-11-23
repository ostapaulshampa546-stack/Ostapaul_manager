import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Flash, PageHeader, StatusBadge, sp } from "@/components/ui";
import { PaymentForm } from "@/components/PaymentForm";
import { PaymentsList } from "@/components/PaymentsList";
import { date, money } from "@/lib/format";

export default async function SchoolInvoice({ params, searchParams }: { params: Promise<{ tenantId: string; invoiceId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId, invoiceId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  const supabase = await createClient();
  const { data: i } = await supabase.from("student_invoices").select("*, students(first_name, post_name, last_name, matricule, guardian_name, guardian_phone, classes(name))").eq("id", invoiceId).eq("tenant_id", tenantId).maybeSingle();
  if (!i) notFound();
  const s = i.students as { first_name: string; post_name: string | null; last_name: string; matricule: string; guardian_name: string | null; guardian_phone: string | null; classes: { name: string } | null };
  const remaining = Number(i.net_amount) - Number(i.paid_amount);
  const back = `/t/${tenantId}/school/invoices/${invoiceId}`;
  return (
    <div>
      <PageHeader title={`${i.description} — ${s.last_name} ${s.post_name ?? ""} ${s.first_name}`} subtitle={<>{s.matricule} · {s.classes?.name} · facture {i.number} · <StatusBadge status={i.status} /></>} />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card space-y-1 text-sm">
          <div className="flex justify-between"><span>Montant</span><span>{money(i.amount, i.currency)}</span></div>
          <div className="flex justify-between text-emerald-700"><span>Bourse / réduction</span><span>− {money(i.discount, i.currency)}</span></div>
          <div className="flex justify-between font-bold"><span>Net à payer</span><span>{money(i.net_amount, i.currency)}</span></div>
          <div className="flex justify-between"><span>Déjà payé</span><span>{money(i.paid_amount, i.currency)}</span></div>
          <div className="flex justify-between text-lg font-bold"><span>Reste</span><span>{money(remaining, i.currency)}</span></div>
          <div className="pt-2 text-xs text-slate-500">Échéance {date(i.due_date)} · Parent : {s.guardian_name ?? "—"} {s.guardian_phone ?? ""}</div>
        </div>
        {remaining > 0 && ctx.active && (ctx.can("payments.cash") || ctx.can("fees.write")) && (
          <div className="card"><h2 className="mb-3 font-bold">Encaisser</h2>
            <PaymentForm tenantId={tenantId} payableType="student_invoice" payableId={invoiceId} remaining={remaining} currency={i.currency} back={back}
              mobileEnabled={ctx.has("payments_mobile")} defaultPayer={s.guardian_name ?? ""} /></div>
        )}
        <div className="card"><h2 className="mb-2 font-bold">Paiements</h2><PaymentsList tenantId={tenantId} payableId={invoiceId} back={back} /></div>
      </div>
    </div>
  );
}
