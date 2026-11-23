"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { str, withParam } from "@/lib/server-actions";
import { initiateDeposit } from "@/lib/payments/pawapay";

/**
 * Paiement d'abonnement par Mobile Money. Le propriétaire est vérifié via sa session (RLS),
 * puis le paiement « en attente » est créé côté serveur ; il ne sera validé que par la
 * vérification du prestataire (webhook ou bouton Vérifier).
 */
export async function paySubscription(fd: FormData) {
  const tenantId = str(fd, "tenant"); const back = `/t/${tenantId}/subscription`;
  const method = str(fd, "method");
  if (!["orange_money", "airtel_money", "mpesa"].includes(method)) redirect(withParam(back, "error", "Moyen invalide"));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: t } = await supabase.from("tenants").select("owner_id").eq("id", tenantId).maybeSingle();
  if (!user || t?.owner_id !== user.id) redirect(withParam(back, "error", "Seul le propriétaire peut payer l'abonnement."));
  const { data: inv } = await supabase.from("subscription_invoices").select("*").eq("id", str(fd, "invoice")).eq("tenant_id", tenantId).eq("status", "unpaid").maybeSingle();
  if (!inv) redirect(withParam(back, "error", "Facture introuvable ou déjà payée."));
  const admin = createAdminClient();
  const { data: p, error } = await admin.from("payments").insert({
    tenant_id: tenantId, payable_type: "subscription_invoice", payable_id: inv.id, amount: inv.amount_usd, currency: "USD", method,
    status: "pending", payer_phone: str(fd, "phone"), provider: "pawapay", recorded_by: user!.id,
  }).select("id, reference").single();
  if (error) redirect(withParam(back, "error", error.message));
  try {
    const res = await initiateDeposit({ depositId: p!.id, amount: Number(inv.amount_usd), currency: "USD", method, phone: str(fd, "phone"), description: `OSTAPAUL ${inv.number}` });
    await admin.from("payment_events").insert({ payment_id: p!.id, provider: "pawapay", event_type: "initiate", payload: res });
    if (res.status === "REJECTED") {
      await admin.from("payments").update({ status: "failed" }).eq("id", p!.id);
      redirect(withParam(back, "error", "Paiement refusé par l'opérateur."));
    }
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    await admin.from("payments").update({ status: "failed", failure_reason: (e as Error).message.slice(0, 300) }).eq("id", p!.id);
    redirect(withParam(back, "error", `Échec : ${(e as Error).message}`));
  }
  redirect(withParam(back, "success", `Validez le paiement sur votre téléphone (réf. ${p!.reference}). L'abonnement sera activé dès la confirmation de l'opérateur.`));
}
