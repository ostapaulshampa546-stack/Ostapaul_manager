import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Flash, Locked, PageHeader, sp } from "@/components/ui";
import { failIfError, numOrNull, str, withParam } from "@/lib/server-actions";
import { OcrScanner } from "./OcrScanner";

async function saveExpense(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"); const back = `/t/${tenantId}/ocr`;
  const amount = numOrNull(fd, "amount");
  if (!amount || amount <= 0) redirect(withParam(back, "error", "Montant invalide"));
  const supabase = await createClient();
  const { error } = await supabase.from("expenses").insert({
    tenant_id: tenantId, amount, currency: str(fd, "currency") === "CDF" ? "CDF" : "USD", category: str(fd, "category") || "Divers",
    description: str(fd, "description") || null, expense_date: str(fd, "date") || undefined, status: str(fd, "status") === "unpaid" ? "unpaid" : "paid", source: "ocr",
  });
  await failIfError(supabase, tenantId, error, "insert:expenses", back);
  redirect(withParam(back, "success", "Dépense validée et enregistrée."));
}

export default async function OcrPage({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.has("ocr")) return <Locked feature="Scanner intelligent (OCR IA)" tenantId={tenantId} tierLabel="Premium" />;
  return (
    <div>
      <PageHeader title="🧠 Scanner intelligent" subtitle="Photographiez une facture, un reçu ou un bon de commande : les informations sont extraites puis soumises à votre validation avant tout enregistrement." />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <OcrScanner tenantId={tenantId} save={saveExpense} canSave={ctx.can("finance.write") && ctx.active} />
    </div>
  );
}
