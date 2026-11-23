import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { dateTime, METHOD_LABELS, money } from "@/lib/format";
import { StatusBadge } from "@/components/ui";
import { cancelPayment } from "@/lib/payments/actions";

export async function PaymentsList({ tenantId, payableId, back }: { tenantId: string; payableId: string; back: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("payments").select("*").eq("tenant_id", tenantId).eq("payable_id", payableId).order("created_at", { ascending: false });
  if (!data?.length) return <p className="text-sm text-slate-500">Aucun paiement.</p>;
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {data.map((p) => (
        <li key={p.id} className="py-2">
          <div className="flex justify-between"><span className="font-semibold">{money(p.amount, p.currency)}</span><StatusBadge status={p.status} /></div>
          <div className="text-xs text-slate-500">{METHOD_LABELS[p.method]} · {dateTime(p.created_at)} · {p.reference}</div>
          <div className="mt-1 flex gap-1">
            {p.status === "succeeded" && <Link href={`/t/${tenantId}/receipt/${p.id}`} className="btn-ghost btn-sm">Reçu</Link>}
            {p.status === "pending" && (
              <>
                <form action="/api/payments/status" method="post"><input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={back} /><button className="btn-ghost btn-sm">Vérifier</button></form>
                <form action={cancelPayment}><input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="id" value={p.id} /><input type="hidden" name="back" value={back} /><button className="btn-ghost btn-sm text-red-600">Annuler</button></form>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
