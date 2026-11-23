"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { failIfError, numOrNull, str, withParam } from "@/lib/server-actions";

export async function createDocument(fd: FormData) {
  const tenantId = str(fd, "tenant");
  const type = ["quote", "order", "invoice"].includes(str(fd, "doc_type")) ? str(fd, "doc_type") : "quote";
  const supabase = await createClient();
  const tax = numOrNull(fd, "tax_rate");
  const { data, error } = await supabase.from("sales_documents").insert({
    tenant_id: tenantId, doc_type: type, number: "", customer_id: str(fd, "customer_id") || null,
    currency: str(fd, "currency") === "CDF" ? "CDF" : "USD", tax_rate: tax ?? 16, due_date: str(fd, "due_date") || null, notes: str(fd, "notes") || null,
  }).select("id").single();
  await failIfError(supabase, tenantId, error, "insert:sales_documents", `/t/${tenantId}/pme/documents?type=${type}`);
  redirect(`/t/${tenantId}/pme/documents/${data!.id}`);
}

export async function addLine(fd: FormData) {
  const tenantId = str(fd, "tenant"), doc = str(fd, "doc");
  const back = `/t/${tenantId}/pme/documents/${doc}`;
  const supabase = await createClient();
  const productId = str(fd, "product_id") || null;
  let description = str(fd, "description"), price = numOrNull(fd, "unit_price");
  if (productId && (!description || price === null)) {
    const { data: p } = await supabase.from("products").select("name, sale_price").eq("id", productId).maybeSingle();
    description ||= p?.name ?? ""; price ??= Number(p?.sale_price ?? 0);
  }
  const { error } = await supabase.from("sales_document_items").insert({ tenant_id: tenantId, document_id: doc, product_id: productId, description: description || "Article",
    quantity: numOrNull(fd, "quantity") ?? 1, unit_price: price ?? 0 });
  await failIfError(supabase, tenantId, error, "insert:sales_document_items", back);
  redirect(back);
}

export async function removeLine(fd: FormData) {
  const tenantId = str(fd, "tenant"), doc = str(fd, "doc");
  const back = `/t/${tenantId}/pme/documents/${doc}`;
  const supabase = await createClient();
  const { error } = await supabase.from("sales_document_items").delete().eq("id", str(fd, "id")).eq("tenant_id", tenantId);
  await failIfError(supabase, tenantId, error, "delete:sales_document_items", back);
  redirect(back);
}

export async function docAction(fd: FormData) {
  const tenantId = str(fd, "tenant"), doc = str(fd, "doc"), action = str(fd, "action");
  const back = `/t/${tenantId}/pme/documents/${doc}`;
  const supabase = await createClient();
  if (action === "issue") {
    const { error } = await supabase.rpc("issue_invoice", { p_doc: doc });
    await failIfError(supabase, tenantId, error, "issue_invoice", back);
    redirect(withParam(back, "success", "Facture émise : vente enregistrée et stock mis à jour."));
  }
  if (action === "to_order" || action === "to_invoice") {
    const { data, error } = await supabase.rpc("convert_sales_document", { p_doc: doc, p_target: action === "to_order" ? "order" : "invoice" });
    await failIfError(supabase, tenantId, error, "convert_sales_document", back);
    redirect(`/t/${tenantId}/pme/documents/${data}`);
  }
  const statuses: Record<string, string> = { sent: "sent", accepted: "accepted", rejected: "rejected", cancel: "cancelled" };
  if (statuses[action]) {
    const { error } = await supabase.from("sales_documents").update({ status: statuses[action] }).eq("id", doc).eq("tenant_id", tenantId);
    await failIfError(supabase, tenantId, error, "update:sales_documents", back);
  }
  redirect(back);
}
