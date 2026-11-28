import type { Field } from "@/lib/resources";

/** Convertit une valeur de formulaire en valeur de base, avec contrôle. Lève une Error lisible si invalide. */
export function coerce(f: Field, raw: FormDataEntryValue | null): unknown {
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

export const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Valeur saisie dans un fichier (Excel, CSV, collage) → valeur attendue par `coerce`.
 * Tolère les formats courants : 12/03/2010, 1 250,50 $, « Masculin », « oui », « FC »…
 */
export function normalizeImported(f: Field, raw: string): string {
  let v = (raw ?? "").replace(/ /g, " ").trim();
  if (v === "") return f.type === "bool" ? (f.defaultValue === "true" ? "true" : "false") : "";
  switch (f.type) {
    case "bool": return /^(oui|o|yes|y|vrai|true|1|x|✓|actif|active|disponible)$/i.test(v) ? "true" : "false";
    case "number":
    case "money": {
      const original = v;
      v = v.replace(/[^\d,.\-]/g, "");
      if (!/\d/.test(v)) return original; // texte non numérique : sera refusé avec un message clair
      if (v.includes(",") && v.includes(".")) v = v.lastIndexOf(",") > v.lastIndexOf(".") ? v.replace(/\./g, "").replace(",", ".") : v.replace(/,/g, "");
      else if (/^\-?\d{1,3}(,\d{3})+$/.test(v)) v = v.replace(/,/g, "");
      else v = v.replace(",", ".");
      return v;
    }
    case "date": {
      let m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
      if (m) {
        const y = m[3].length === 2 ? (Number(m[3]) > 40 ? "19" : "20") + m[3] : m[3];
        return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      }
      m = v.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/);
      if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
      if (/^\d{5}$/.test(v)) { // numéro de série Excel
        const d = new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000);
        return d.toISOString().slice(0, 10);
      }
      return v;
    }
    case "time": {
      const m = v.match(/^(\d{1,2})[:hH](\d{2})?/);
      return m ? `${m[1].padStart(2, "0")}:${m[2] ?? "00"}` : v;
    }
    case "currency": {
      const n = norm(v);
      if (/^(cdf|fc|franc|francs|franc congolais)$/.test(n)) return "CDF";
      if (/^(usd|dollar|dollars|us)$/.test(n) || v === "$") return "USD";
      return v.toUpperCase();
    }
    case "select": {
      const n = norm(v);
      const hit = f.options?.find((o) => norm(o.value) === n || norm(o.label) === n || norm(o.label).startsWith(n) && n.length >= 1 && f.name === "gender");
      if (hit) return hit.value;
      if (f.name === "gender") { if (/^(h|homme|garcon|m|masculin)$/.test(n)) return "M"; if (/^(f|femme|fille|feminin)$/.test(n)) return "F"; }
      return v;
    }
    case "email": return v.toLowerCase();
    default: return v;
  }
}
