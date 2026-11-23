import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/PrintButton";
import { dateTime, METHOD_LABELS, money } from "@/lib/format";
import { qrSvg, receiptUrl } from "@/lib/qr";

export default async function Ticket({ params }: { params: Promise<{ tenantId: string; orderId: string }> }) {
  const { tenantId, orderId } = await params;
  const ctx = await getTenantContext(tenantId);
  const supabase = await createClient();
  const [{ data: o }, { data: items }, { data: pays }] = await Promise.all([
    supabase.from("orders").select("*, dining_tables(label), employees(first_name)").eq("id", orderId).eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("order_items").select("*").eq("order_id", orderId).neq("kitchen_status", "cancelled").order("created_at"),
    supabase.from("payments").select("*").eq("payable_id", orderId).eq("status", "succeeded"),
  ]);
  if (!o) notFound();
  const last = pays?.[pays.length - 1];
  const qr = last ? await qrSvg(receiptUrl(last.receipt_token)) : null;
  return (
    <div>
      <div className="no-print mb-4"><PrintButton label="Imprimer le ticket" /></div>
      <div className="print-area mx-auto w-[300px] bg-white p-4 font-mono text-xs text-black shadow">
        <div className="text-center text-sm font-bold">{ctx.tenant.name}</div>
        <div className="text-center">{ctx.tenant.address ?? ""} {ctx.tenant.city ?? ""}</div>
        {ctx.tenant.phone && <div className="text-center">Tél. {ctx.tenant.phone}</div>}
        <div className="my-2 border-t border-dashed border-black" />
        <div>Commande #{o.number} — {dateTime(o.created_at)}</div>
        <div>{o.order_type === "dine_in" ? `Table ${(o.dining_tables as { label?: string } | null)?.label ?? ""}` : o.order_type === "takeaway" ? "À emporter" : "Livraison"}
          {o.employees && ` · Serveur : ${(o.employees as { first_name: string }).first_name}`}</div>
        <div className="my-2 border-t border-dashed border-black" />
        {(items ?? []).map((i) => (
          <div key={i.id} className="flex justify-between"><span>{i.quantity} × {i.name}</span><span>{money(i.line_total, o.currency)}</span></div>
        ))}
        <div className="my-2 border-t border-dashed border-black" />
        {Number(o.discount) > 0 && <div className="flex justify-between"><span>Remise</span><span>-{money(o.discount, o.currency)}</span></div>}
        <div className="flex justify-between text-sm font-bold"><span>TOTAL</span><span>{money(o.total, o.currency)}</span></div>
        {(pays ?? []).map((p) => <div key={p.id} className="flex justify-between"><span>{METHOD_LABELS[p.method]}</span><span>{money(p.amount, p.currency)}</span></div>)}
        <div className="flex justify-between"><span>Reste</span><span>{money(Math.max(0, Number(o.total) - Number(o.paid_amount)), o.currency)}</span></div>
        {qr && <div className="mx-auto mt-3 w-24" dangerouslySetInnerHTML={{ __html: qr }} />}
        {last && <div className="text-center">Reçu {last.receipt_number}</div>}
        <div className="mt-2 text-center">Merci de votre visite !</div>
        <div className="text-center text-[10px]">OSTAPAUL MANAGER</div>
      </div>
    </div>
  );
}
