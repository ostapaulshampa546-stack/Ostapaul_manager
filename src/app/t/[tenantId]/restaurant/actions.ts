"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { failIfError, numOrNull, str, withParam } from "@/lib/server-actions";

const ORDER_STATUSES = ["new", "in_kitchen", "ready", "served", "cancelled"];
const ITEM_STATUSES = ["pending", "preparing", "ready", "served", "cancelled"];

export async function createOrder(fd: FormData) {
  const tenantId = str(fd, "tenant");
  const supabase = await createClient();
  const type = ["dine_in", "takeaway", "delivery"].includes(str(fd, "order_type")) ? str(fd, "order_type") : "dine_in";
  const { data, error } = await supabase.from("orders").insert({
    tenant_id: tenantId, order_type: type,
    table_id: type === "dine_in" ? str(fd, "table_id") || null : null,
    waiter_id: str(fd, "waiter_id") || null,
    customer_name: str(fd, "customer_name") || null, customer_phone: str(fd, "customer_phone") || null,
    currency: str(fd, "currency") === "CDF" ? "CDF" : "USD", number: "auto",
  }).select("id").single();
  await failIfError(supabase, tenantId, error, "insert:orders", `/t/${tenantId}/restaurant/pos`);
  redirect(`/t/${tenantId}/restaurant/orders/${data!.id}`);
}

export async function addItem(fd: FormData) {
  const tenantId = str(fd, "tenant"); const orderId = str(fd, "order");
  const back = `/t/${tenantId}/restaurant/orders/${orderId}`;
  const qty = Math.round(numOrNull(fd, "quantity") ?? 1);
  if (qty < 1 || qty > 999) redirect(withParam(back, "error", "Quantité invalide"));
  const supabase = await createClient();
  const { error } = await supabase.from("order_items").insert({
    tenant_id: tenantId, order_id: orderId, menu_item_id: str(fd, "menu_item_id"), name: "-", unit_price: 0, quantity: qty, notes: str(fd, "notes") || null,
  });
  await failIfError(supabase, tenantId, error, "insert:order_items", back);
  revalidatePath(back);
  redirect(back);
}

export async function removeItem(fd: FormData) {
  const tenantId = str(fd, "tenant"); const orderId = str(fd, "order");
  const back = `/t/${tenantId}/restaurant/orders/${orderId}`;
  const supabase = await createClient();
  const { error } = await supabase.from("order_items").delete().eq("id", str(fd, "id")).eq("tenant_id", tenantId);
  await failIfError(supabase, tenantId, error, "delete:order_items", back);
  redirect(back);
}

export async function setOrderStatus(fd: FormData) {
  const tenantId = str(fd, "tenant"); const orderId = str(fd, "order");
  const back = str(fd, "back") || `/t/${tenantId}/restaurant/orders/${orderId}`;
  const status = str(fd, "status");
  if (!ORDER_STATUSES.includes(status)) redirect(withParam(back, "error", "Statut invalide"));
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ status }).eq("id", orderId).eq("tenant_id", tenantId);
  await failIfError(supabase, tenantId, error, "update:orders", back);
  if (status === "ready" || status === "served") {
    await supabase.from("order_items").update({ kitchen_status: status }).eq("order_id", orderId).neq("kitchen_status", "cancelled");
  }
  revalidatePath(back);
  redirect(back);
}

export async function setItemStatus(fd: FormData) {
  const tenantId = str(fd, "tenant");
  const back = str(fd, "back");
  const status = str(fd, "status");
  if (!ITEM_STATUSES.includes(status)) redirect(back);
  const supabase = await createClient();
  const { error } = await supabase.from("order_items").update({ kitchen_status: status }).eq("id", str(fd, "id")).eq("tenant_id", tenantId);
  await failIfError(supabase, tenantId, error, "update:order_items", back);
  // commande prête quand tous les articles le sont
  const orderId = str(fd, "order");
  const { data: items } = await supabase.from("order_items").select("kitchen_status").eq("order_id", orderId);
  if (items?.length && items.every((i) => ["ready", "served", "cancelled"].includes(i.kitchen_status))) {
    await supabase.from("orders").update({ status: "ready" }).eq("id", orderId).eq("status", "in_kitchen");
  }
  revalidatePath(back);
  redirect(back);
}

export async function setDiscount(fd: FormData) {
  const tenantId = str(fd, "tenant"); const orderId = str(fd, "order");
  const back = `/t/${tenantId}/restaurant/orders/${orderId}`;
  const discount = numOrNull(fd, "discount") ?? 0;
  if (discount < 0) redirect(withParam(back, "error", "Remise invalide"));
  const supabase = await createClient();
  const { error } = await supabase.from("orders").update({ discount }).eq("id", orderId).eq("tenant_id", tenantId);
  await failIfError(supabase, tenantId, error, "update:orders", back);
  redirect(back);
}
