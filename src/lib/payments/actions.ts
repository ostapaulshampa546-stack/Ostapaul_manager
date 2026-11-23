"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { failIfError, numOrNull, str, withParam } from "@/lib/server-actions";
import { initiateDeposit, isConfigured } from "@/lib/payments/pawapay";

const TYPES = ["order", "student_invoice", "sales_document", "other"];
const METHODS = ["cash", "orange_money", "airtel_money", "mpesa"];

/** Enregistre un paiement : espèces (immédiat, par le caissier) ou Mobile Money (en attente de confirmation). */
export async function recordPayment(formData: FormData) {
  const tenantId = str(formData, "tenant");
  const back = str(formData, "back") || `/t/${tenantId}/finance/payments`;
  const payable_type = str(formData, "payable_type");
  const method = str(formData, "method");
  const amount = numOrNull(formData, "amount");
  const currency = str(formData, "currency") === "CDF" ? "CDF" : "USD";
  const phone = str(formData, "payer_phone");
  if (!TYPES.includes(payable_type) || !METHODS.includes(method)) redirect(withParam(back, "error", "Paiement invalide"));
  if (!amount || amount <= 0) redirect(withParam(back, "error", "Montant invalide"));
  if (method !== "cash" && !phone) redirect(withParam(back, "error", "Numéro Mobile Money requis"));
  if (method !== "cash" && !isConfigured()) {
    redirect(withParam(back, "error", "Mobile Money non configuré sur ce serveur (clé agrégateur manquante). Utilisez l'espèce ou contactez l'administrateur."));
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("payments").insert({
    tenant_id: tenantId, payable_type, payable_id: str(formData, "payable_id") || null, amount, currency, method,
    payer_name: str(formData, "payer_name") || null, payer_phone: phone || null,
  }).select("id, reference, receipt_token, status").single();
  await failIfError(supabase, tenantId, error, "insert:payments", back);

  if (method === "cash") {
    revalidatePath(back);
    redirect(withParam(back, "success", `Paiement en espèces enregistré — reçu ${data!.reference}.`));
  }

  try {
    const res = await initiateDeposit({ depositId: data!.id, amount: amount!, currency, method, phone, description: `OSTAPAUL ${data!.reference}` });
    const admin = createAdminClient();
    await admin.from("payment_events").insert({ payment_id: data!.id, provider: "pawapay", event_type: "initiate", verified: false, payload: res });
    if (res.status === "REJECTED") {
      await admin.from("payments").update({ status: "failed", failure_reason: JSON.stringify(res.rejectionReason ?? "rejected").slice(0, 300) }).eq("id", data!.id);
      redirect(withParam(back, "error", "Paiement refusé par l'opérateur Mobile Money."));
    }
    await admin.from("payments").update({ provider: "pawapay" }).eq("id", data!.id);
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    redirect(withParam(back, "error", `Échec de l'initiation : ${(e as Error).message}`));
  }
  revalidatePath(back);
  redirect(withParam(back, "success", `Demande envoyée au téléphone ${phone}. Le client doit valider avec son code PIN ; le paiement sera confirmé automatiquement (réf. ${data!.reference}).`));
}

/** Annule un paiement électronique resté en attente. */
export async function cancelPayment(formData: FormData) {
  const tenantId = str(formData, "tenant");
  const back = str(formData, "back");
  const supabase = await createClient();
  const { error } = await supabase.from("payments").update({ status: "cancelled" }).eq("id", str(formData, "id")).eq("tenant_id", tenantId).eq("status", "pending");
  await failIfError(supabase, tenantId, error, "cancel:payments", back);
  redirect(withParam(back, "success", "Paiement annulé."));
}
