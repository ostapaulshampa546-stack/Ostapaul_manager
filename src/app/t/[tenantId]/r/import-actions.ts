"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/context";
import { getResource, type Field } from "@/lib/resources";
import { coerce, norm, normalizeImported } from "@/lib/resource-values";
import { encryptField } from "@/lib/crypto";
import { AUTO_CREATE, IMPORTABLE, MAX_IMPORT_ROWS } from "@/lib/import-config";

export type ImportRow = { line: number; values: Record<string, string> };
export type ImportResult =
  | { ok: true; inserted: number; errors: { line: number; message: string }[]; created: { label: string; names: string[] }[] }
  | { ok: false; error: string };

const CHUNK = 200;

/**
 * Enregistre plusieurs lignes d'un coup, avec les mêmes contrôles que la saisie une par une
 * (droits, formule, validation, chiffrement des données sensibles). Les relations
 * (classe, catégorie, fournisseur, enseignant…) sont retrouvées par leur nom.
 */
export async function importRows(tenantId: string, key: string, rows: ImportRow[], createMissing: boolean): Promise<ImportResult> {
  const res = getResource(key);
  if (!res || !IMPORTABLE.has(key) || !/^[0-9a-f-]{36}$/i.test(tenantId)) return { ok: false, error: "Import non disponible pour cette rubrique." };
  if (!Array.isArray(rows) || !rows.length) return { ok: false, error: "Aucune ligne à importer." };
  if (rows.length > MAX_IMPORT_ROWS) return { ok: false, error: `Maximum ${MAX_IMPORT_ROWS} lignes par import : découpez votre fichier.` };

  const ctx = await getTenantContext(tenantId);
  if (!res.sectors.includes(ctx.tenant.sector)) return { ok: false, error: "Rubrique non disponible pour ce secteur." };
  if (!ctx.can(res.writePerm)) return { ok: false, error: "Vous n'avez pas le droit d'ajouter des éléments ici." };
  if (!ctx.active) return { ok: false, error: "Établissement en lecture seule : renouvelez l'abonnement pour ajouter des éléments." };
  if (res.feature && !ctx.has(res.feature)) return { ok: false, error: "Cette rubrique n'est pas incluse dans votre formule." };

  const supabase = await createClient();
  const errors: { line: number; message: string }[] = [];
  const created: { label: string; names: string[] }[] = [];

  // 1. Relations : nom → identifiant (et création des références manquantes si demandé)
  const relFields = res.fields.filter((f) => f.type === "relation" && f.relation);
  const relMaps: Record<string, Map<string, string>> = {};
  for (const f of relFields) {
    const r = f.relation!;
    const used = new Set(rows.map((row) => (row.values[f.name] ?? "").trim()).filter(Boolean));
    if (!used.size) continue;
    let q = supabase.from(r.table).select(["id", ...r.labelColumns].join(",")).eq("tenant_id", tenantId).limit(5000);
    for (const [k, v] of Object.entries(r.filter ?? {})) q = q.eq(k, v);
    const { data } = await q;
    const map = new Map<string, string>();
    for (const item of (data ?? []) as unknown as Record<string, unknown>[]) {
      const parts = r.labelColumns.map((c) => String(item[c] ?? "")).filter(Boolean);
      map.set(norm(parts.join(" ")), String(item.id));
      if (parts.length > 1) map.set(norm([...parts].reverse().join(" ")), String(item.id));
    }
    const missing = [...used].filter((name) => !map.has(norm(name)));
    const auto = AUTO_CREATE[r.table];
    if (missing.length && createMissing && auto) {
      const uniq = [...new Map(missing.map((m) => [norm(m), m.slice(0, 120)])).values()];
      const { data: ins, error } = await supabase.from(r.table).insert(uniq.map((n) => ({ tenant_id: tenantId, [auto.column]: n }))).select(`id, ${auto.column}`);
      if (error) return { ok: false, error: `Création des ${auto.label} impossible : ${error.message}` };
      for (const item of (ins ?? []) as unknown as Record<string, string>[]) map.set(norm(item[auto.column]), item.id);
      created.push({ label: auto.label, names: uniq });
    }
    relMaps[f.name] = map;
  }

  // 2. Validation ligne par ligne
  const valid: { line: number; row: Record<string, unknown> }[] = [];
  const seen = new Map<string, number>();
  for (const { line, values } of rows) {
    try {
      const row: Record<string, unknown> = { tenant_id: tenantId };
      for (const f of res.fields) {
        const raw = values[f.name];
        if (raw === undefined && f.type !== "bool") {
          if (f.required) throw new Error(`${f.label} est obligatoire`);
          if (f.defaultValue !== undefined) row[f.name] = coerce(f, normalizeImported(f, f.defaultValue));
          continue;
        }
        let value: unknown;
        if (f.type === "relation") {
          const name = (raw ?? "").trim();
          if (!name) value = null;
          else {
            value = relMaps[f.name]?.get(norm(name));
            if (!value) throw new Error(`${f.label} « ${name} » introuvable${AUTO_CREATE[f.relation!.table] ? " (cochez « créer automatiquement »)" : " : créez-le d'abord"}`);
          }
        } else {
          value = coerce(f, normalizeImported(f as Field, raw ?? (f.defaultValue ?? "")));
        }
        if (f.required && (value === null || value === "")) throw new Error(`${f.label} est obligatoire`);
        if (f.name === "matricule" && value === null) continue;
        row[f.name] = f.sensitive && typeof value === "string" ? encryptField(value) : value;
      }
      // Doublons dans le fichier (même matricule, même référence ou même nom de table)
      const dupKey = ["matricule", "sku", "label"].find((k) => row[k]);
      if (dupKey) {
        const k = `${dupKey}:${norm(String(row[dupKey]))}`;
        if (seen.has(k)) throw new Error(`doublon de la ligne ${seen.get(k)}`);
        seen.set(k, line);
      }
      valid.push({ line, row });
    } catch (e) {
      errors.push({ line, message: (e as Error).message });
    }
  }

  // 3. Enregistrement par paquets ; si un paquet échoue, ligne par ligne pour isoler l'erreur
  let inserted = 0;
  const friendly = (m: string) =>
    /duplicate key|unique/i.test(m) ? "existe déjà (matricule, référence ou nom en double)" :
    /row-level security|permission/i.test(m) ? "droits insuffisants" : m;
  for (let i = 0; i < valid.length; i += CHUNK) {
    const chunk = valid.slice(i, i + CHUNK);
    const { error } = await supabase.from(res.table).insert(chunk.map((c) => c.row));
    if (!error) { inserted += chunk.length; continue; }
    for (const c of chunk) {
      const { error: e1 } = await supabase.from(res.table).insert(c.row);
      if (e1) errors.push({ line: c.line, message: friendly(e1.message) });
      else inserted++;
    }
  }

  revalidatePath(`/t/${tenantId}/r/${key}`);
  if (res.cardType) revalidatePath(`/t/${tenantId}/cards`);
  errors.sort((a, b) => a.line - b.line);
  return { ok: true, inserted, errors: errors.slice(0, 500), created };
}
