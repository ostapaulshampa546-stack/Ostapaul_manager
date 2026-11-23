"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getResource, type Field } from "@/lib/resources";
import { failIfError, withParam } from "@/lib/server-actions";

function coerce(f: Field, raw: FormDataEntryValue | null): unknown {
  if (f.type === "bool") return raw === "on" || raw === "true";
  const v = typeof raw === "string" ? raw.trim() : "";
  if (v === "") return null;
  switch (f.type) {
    case "number":
    case "money": {
      const n = Number(v.replace(",", "."));
      if (!Number.isFinite(n)) throw new Error(`${f.label} : nombre invalide`);
      if (f.min !== undefined && n < f.min) throw new Error(`${f.label} : minimum ${f.min}`);
      if (f.max !== undefined && n > f.max) throw new Error(`${f.label} : maximum ${f.max}`);
      if (f.type === "money" && n < 0) throw new Error(`${f.label} : montant négatif`);
      return n;
    }
    case "date": if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new Error(`${f.label} : date invalide`); return v;
    case "time": if (!/^\d{2}:\d{2}(:\d{2})?$/.test(v)) throw new Error(`${f.label} : heure invalide`); return v;
    case "relation": if (!/^[0-9a-f-]{36}$/i.test(v)) throw new Error(`${f.label} : sélection invalide`); return v;
    case "select":
      if (f.options && !f.options.some((o) => o.value === v)) throw new Error(`${f.label} : valeur non autorisée`);
      return f.name === "weekday" ? Number(v) : v;
    case "currency": if (v !== "USD" && v !== "CDF") throw new Error("Devise invalide"); return v;
    case "email": if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) throw new Error(`${f.label} : e-mail invalide`); return v.slice(0, 200);
    default: return v.slice(0, f.type === "textarea" ? 4000 : 300);
  }
}

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
      row[f.name] = value;
    }
  } catch (e) {
    redirect(withParam(`${back}?${id ? `edit=${id}` : "new=1"}`, "error", (e as Error).message));
  }
  const supabase = await createClient();
  const q = id
    ? supabase.from(res.table).update(row).eq("id", id).eq("tenant_id", tenantId)
    : supabase.from(res.table).insert({ ...row, tenant_id: tenantId });
  const { error } = await q;
  await failIfError(supabase, tenantId, error, `${id ? "update" : "insert"}:${res.table}`, `${back}?${id ? `edit=${id}` : "new=1"}`);
  revalidatePath(back);
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
