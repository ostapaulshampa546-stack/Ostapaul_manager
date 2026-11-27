"use server";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHOTO_BUCKET, PHOTO_TABLES, isJpeg, type PhotoPersonType } from "@/lib/photos";

const MAX_BYTES = 1_500_000;
type Res = { ok: true } | { ok: false, error: string };

async function guard(tenantId: string, type: string, personId: string) {
  if (!(type in PHOTO_TABLES)) throw new Error("Type de personne invalide");
  const cfg = PHOTO_TABLES[type as PhotoPersonType];
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can(cfg.perm)) throw new Error("Vous n'avez pas le droit de modifier cette fiche.");
  const supabase = await createClient();
  const { data: person } = await supabase.from(cfg.table).select("id, photo_path").eq("tenant_id", tenantId).eq("id", personId).maybeSingle();
  if (!person) throw new Error("Personne introuvable.");
  return { cfg, supabase, person: person as { id: string; photo_path: string | null } };
}

async function removeFile(path: string | null) {
  if (!path) return;
  try { await createAdminClient().storage.from(PHOTO_BUCKET).remove([path]); } catch { /* fichier orphelin sans conséquence */ }
}

export async function uploadPhoto(tenantId: string, type: string, personId: string, fd: FormData): Promise<Res> {
  try {
    const { cfg, supabase, person } = await guard(tenantId, type, personId);
    const file = fd.get("photo");
    if (!(file instanceof File) || !file.size) return { ok: false, error: "Aucune photo reçue." };
    if (file.size > MAX_BYTES) return { ok: false, error: "Photo trop lourde (1,5 Mo maximum)." };
    if (!(await isJpeg(file))) return { ok: false, error: "Format d'image non reconnu." };

    const path = `${tenantId}/photos/${type}/${personId}-${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, { contentType: "image/jpeg", upsert: false });
    if (upErr) return { ok: false, error: upErr.message.includes("row-level") ? "Établissement en lecture seule : renouvelez l'abonnement." : "Envoi impossible. Réessayez." };

    const { error } = await supabase.from(cfg.table).update({ photo_path: path }).eq("id", personId).eq("tenant_id", tenantId);
    if (error) { await removeFile(path); return { ok: false, error: "Enregistrement impossible : " + error.message }; }
    await removeFile(person.photo_path);
    revalidatePath(`/t/${tenantId}/cards`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function deletePhoto(tenantId: string, type: string, personId: string): Promise<Res> {
  try {
    const { cfg, supabase, person } = await guard(tenantId, type, personId);
    const { error } = await supabase.from(cfg.table).update({ photo_path: null }).eq("id", personId).eq("tenant_id", tenantId);
    if (error) return { ok: false, error: error.message };
    await removeFile(person.photo_path);
    revalidatePath(`/t/${tenantId}/cards`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}
