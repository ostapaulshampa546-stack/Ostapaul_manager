"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getResource } from "@/lib/resources";
import { failIfError, withParam } from "@/lib/server-actions";
import { encryptField } from "@/lib/crypto";
import { coerce } from "@/lib/resource-values";

export async function saveResource(formData: FormData) {
  const tenantId = String(formData.get("_tenant"));
  const key = String(formData.get("_resource"));
  const id = String(formData.get("_id") ?? "");
  const res = getResource(key);
  const back = `/t/${tenantId}/r/${key}`;
  if (!res || !/^[0-9a-f-]{36}$/i.test(tenantId)) redirect("/app");
  const row: Record<string, unknown> = {};
  try {
    for (const f of res.fields) {
      if (id && f.name === "qty_on_hand") continue; // le stock ne se modifie que par mouvements
      const value = coerce(f, formData.get(f.name));
      if (f.required && (value === null || value === "")) throw new Error(`${f.label} est obligatoire`);
      if (f.name === "matricule" && value === null) continue;
      row[f.name] = f.sensitive && typeof value === "string" ? encryptField(value) : value;
    }
  } catch (e) {
    redirect(withParam(`${back}?${id ? `edit=${id}` : "new=1"}`, "error", (e as Error).message));
  }
  const supabase = await createClient();
  const q = id
    ? supabase.from(res.table).update(row).eq("id", id).eq("tenant_id", tenantId).select("id")
    : supabase.from(res.table).insert({ ...row, tenant_id: tenantId }).select("id");
  const { data: saved, error } = await q;
  await failIfError(supabase, tenantId, error, `${id ? "update" : "insert"}:${res.table}`, `${back}?${id ? `edit=${id}` : "new=1"}`);
  revalidatePath(back);
  // Nouvelle personne : sa carte d'identification (générée automatiquement) s'affiche aussitôt
  const newId = (saved as { id: string }[] | null)?.[0]?.id;
  if (!id && res.cardType && newId) {
    revalidatePath(`/t/${tenantId}/cards`);
    redirect(withParam(`/t/${tenantId}/cards?type=${res.cardType}&id=${newId}`, "success",
      `${res.singular[0].toUpperCase()}${res.singular.slice(1)} enregistré(e) : voici sa carte, prête à imprimer. Ajoutez sa photo ci-dessous.`));
  }
  redirect(withParam(back, "success", id ? "Modifications enregistrées." : `${res.singular[0].toUpperCase()}${res.singular.slice(1)} ajouté(e).`));
}

export async function deleteResource(formData: FormData) {
  const tenantId = String(formData.get("_tenant"));
  const key = String(formData.get("_resource"));
  const id = String(formData.get("_id"));
  const res = getResource(key);
  if (!res) redirect("/app");
  const back = `/t/${tenantId}/r/${key}`;
  const supabase = await createClient();
  const { error, count } = await supabase.from(res.table).delete({ count: "exact" }).eq("id", id).eq("tenant_id", tenantId);
  await failIfError(supabase, tenantId, error, `delete:${res.table}`, back);
  if (!count) redirect(withParam(back, "error", "Suppression impossible : droits insuffisants ou élément introuvable."));
  revalidatePath(back);
  redirect(withParam(back, "success", "Élément supprimé."));
}
