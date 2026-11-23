import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDeposit } from "@/lib/payments/pawapay";

/**
 * Vérifie un paiement électronique auprès du prestataire et applique le résultat.
 * Un paiement n'est marqué « réussi » que si le prestataire confirme COMPLETED avec
 * le même montant et la même devise que ceux enregistrés.
 */
export async function verifyPayment(paymentId: string, source: "webhook" | "poll") {
  const admin = createAdminClient();
  const { data: p } = await admin.from("payments").select("*").eq("id", paymentId).maybeSingle();
  if (!p) return { status: "unknown" as const };
  if (p.method === "cash" || p.status !== "pending") return { status: p.status as string };
  const dep = await getDeposit(paymentId);
  await admin.from("payment_events").insert({ payment_id: paymentId, provider: "pawapay", event_type: `verify:${source}`, verified: true, payload: dep ?? {} });
  if (!dep) return { status: "pending" };
  const amount = Number(dep.depositedAmount ?? dep.requestedAmount);
  const matches = Math.abs(amount - Number(p.amount)) < 0.01 && (!dep.currency || dep.currency === p.currency);
  if (dep.status === "COMPLETED" && matches) {
    await admin.from("payments").update({ status: "succeeded", provider: "pawapay", provider_ref: dep.depositId }).eq("id", paymentId).eq("status", "pending");
    return { status: "succeeded" };
  }
  if (dep.status === "COMPLETED" && !matches) {
    await admin.from("fraud_alerts").insert({ tenant_id: p.tenant_id, kind: "amount_mismatch", severity: "high", title: "Montant confirmé différent du montant attendu",
      details: { reference: p.reference, expected: p.amount, confirmed: amount, currency: dep.currency }, ref_table: "payments", ref_id: paymentId });
    return { status: "pending" };
  }
  if (dep.status === "FAILED") {
    await admin.from("payments").update({ status: "failed", failure_reason: JSON.stringify(dep.failureReason ?? "").slice(0, 300) }).eq("id", paymentId).eq("status", "pending");
    return { status: "failed" };
  }
  return { status: "pending" };
}
