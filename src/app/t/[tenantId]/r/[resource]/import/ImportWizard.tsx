"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { importRows, type ImportResult, type ImportRow } from "../../import-actions";
import { parseDelimited, parseFile, templateCsv, type Grid } from "@/lib/sheet-parse";
import { guessField } from "@/lib/import-config";
import { normalizeImported } from "@/lib/resource-values";
import type { Field } from "@/lib/resources";

export type WizardField = {
  name: string; label: string; type: Field["type"]; required: boolean; hint?: string; defaultValue?: string;
  options?: { value: string; label: string }[]; choices?: string[]; autoCreate?: string; sensitive: boolean;
};

type Mode = "file" | "paste" | "grid";

/** Exemples du modèle à télécharger. */
const EXAMPLES: Record<string, Record<string, string>[]> = {
  products: [{ name: "Coca-Cola 33 cl", sku: "BOI-001", category: "Boissons", unit: "bouteille", cost_price: "0,60", sale_price: "1", currency: "USD", qty_on_hand: "48", min_qty: "12" },
             { name: "Riz 25 kg", sku: "ALI-010", category: "Alimentation", unit: "sac", cost_price: "28", sale_price: "32", currency: "USD", qty_on_hand: "10", min_qty: "2" }],
  menu_items: [{ name: "Poulet mayo", category_id: "Plats", price: "12", currency: "USD", is_available: "oui" },
               { name: "Fufu + pondu", category_id: "Plats", price: "15000", currency: "CDF", is_available: "oui" }],
  menu_categories: [{ name: "Entrées", sort: "1" }, { name: "Plats", sort: "2" }, { name: "Boissons", sort: "3" }],
  dining_tables: [{ label: "Table 1", seats: "4", zone: "Salle" }, { label: "Table 2", seats: "6", zone: "Terrasse" }],
  students: [{ last_name: "KABILA", post_name: "MWAMBA", first_name: "Joseph", gender: "M", birth_date: "12/03/2012", class_id: "6e Primaire A", guardian_name: "Marie Kabila", guardian_phone: "+243 81 234 5678" },
             { last_name: "MBUYI", post_name: "NTUMBA", first_name: "Grâce", gender: "F", birth_date: "05/09/2011", class_id: "6e Primaire A", guardian_name: "Paul Mbuyi", guardian_phone: "+243 99 765 4321" }],
  teachers: [{ last_name: "LUMBU", first_name: "André", gender: "M", specialty: "Mathématiques", phone: "+243 81 000 0001" }],
  employees: [{ last_name: "NGOY", first_name: "Sarah", gender: "F", position: "Caissière", department: "Salle", phone: "+243 82 000 0002", hire_date: "01/02/2025", salary: "250", salary_currency: "USD" }],
  classes: [{ name: "6e Primaire A", level: "Primaire" }, { name: "L1 Informatique", level: "Graduat / Licence", option_name: "Informatique" }],
  courses: [{ name: "Mathématiques", class_id: "6e Primaire A", max_points: "20" }],
  customers: [{ name: "Société ABC SARL", customer_type: "Entreprise", phone: "+243 81 111 2222", email: "contact@abc.cd" }],
  suppliers: [{ name: "Brasimba", phone: "+243 81 333 4444" }],
  fee_types: [{ name: "Minerval 1er trimestre", amount: "50", currency: "USD", class_id: "6e Primaire A", due_date: "30/10/2026" }],
};

export function ImportWizard({ tenantId, resourceKey, title, singular, fields, cardType, backHref, cardsHref }: {
  tenantId: string; resourceKey: string; title: string; singular: string; fields: WizardField[];
  cardType: string | null; backHref: string; cardsHref: string | null;
}) {
  const [mode, setMode] = useState<Mode>("file");
  const [grid, setGrid] = useState<Grid | null>(null);
  const [hasHeader, setHasHeader] = useState(true);
  const [mapping, setMapping] = useState<string[]>([]);
  const [paste, setPaste] = useState("");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [manual, setManual] = useState<Record<string, string>[]>(() => Array.from({ length: 5 }, () => ({})));
  const [createMissing, setCreateMissing] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const fieldByName = useMemo(() => new Map(fields.map((f) => [f.name, f])), [fields]);
  const gridFields = fields.filter((f) => f.type !== "textarea" || f.name === "description");
  const hasAutoCreate = fields.some((f) => f.autoCreate);

  const loadGrid = (g: Grid) => {
    if (!g.length) { setParseError("Le tableau est vide."); return; }
    const used = new Set<string>();
    const guesses = g[0].map((h) => { const n = guessField(h, fields as unknown as Field[], used); if (n) used.add(n); return n; });
    const header = guesses.filter(Boolean).length > 0;
    setHasHeader(header);
    setMapping(header ? guesses : g[0].map((_, i) => fields.filter((f) => f.name !== "matricule")[i]?.name ?? ""));
    setGrid(g); setParseError(null); setResult(null);
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    setFileName(f.name);
    try { loadGrid(await parseFile(f)); } catch (e) { setGrid(null); setParseError((e as Error).message || "Fichier illisible."); }
  };

  const downloadTemplate = () => {
    const cols = fields.filter((f) => f.type !== "textarea");
    const ex = (EXAMPLES[resourceKey] ?? []).map((r) => cols.map((f) => r[f.name] ?? ""));
    const blob = new Blob([templateCsv(cols.map((f) => f.label), ex)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `modele-${resourceKey}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // Lignes prêtes à envoyer
  const rows: ImportRow[] = useMemo(() => {
    if (mode === "grid") {
      return manual.map((values, i) => ({ line: i + 1, values }))
        .filter((r) => Object.entries(r.values).some(([k, v]) => v.trim() !== "" && fieldByName.get(k)?.type !== "bool"))
        .map((r) => ({ line: r.line, values: Object.fromEntries(Object.entries(r.values).filter(([, v]) => v !== "")) }));
    }
    if (!grid) return [];
    const body = hasHeader ? grid.slice(1) : grid;
    return body.map((cells, i) => {
      const values: Record<string, string> = {};
      mapping.forEach((name, c) => { if (name && cells[c] !== undefined && cells[c] !== "") values[name] = cells[c]; });
      return { line: i + (hasHeader ? 2 : 1), values };
    }).filter((r) => Object.keys(r.values).length > 0);
  }, [mode, manual, grid, hasHeader, mapping, fieldByName]);

  const mappedNames = new Set(mode === "grid" ? fields.map((f) => f.name) : mapping.filter(Boolean));
  const missingRequired = fields.filter((f) => f.required && !mappedNames.has(f.name));
  const unknownRefs = useMemo(() => {
    const out: { field: WizardField; names: string[] }[] = [];
    for (const f of fields.filter((x) => x.type === "relation")) {
      const known = new Set((f.choices ?? []).map((c) => c.toLowerCase()));
      const names = [...new Set(rows.map((r) => r.values[f.name]).filter((v): v is string => !!v && !known.has(v.toLowerCase())))];
      if (names.length) out.push({ field: f, names });
    }
    return out;
  }, [rows, fields]);

  const submit = () => {
    setResult(null);
    start(async () => {
      const r = await importRows(tenantId, resourceKey, rows, createMissing);
      setResult(r);
      if (r.ok && r.inserted) router.refresh();
    });
  };

  const Tab = ({ m, children }: { m: Mode; children: React.ReactNode }) => (
    <button type="button" onClick={() => { setMode(m); setResult(null); }}
      className={`rounded-xl px-4 py-2 text-sm font-semibold ${mode === m ? "bg-navy-900 text-white" : "bg-white text-navy-900 ring-1 ring-slate-200 hover:bg-slate-50"}`}>{children}</button>
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Tab m="file">📄 Importer un fichier Excel / CSV</Tab>
        <Tab m="paste">📋 Copier-coller depuis Excel</Tab>
        <Tab m="grid">⌨️ Saisir plusieurs à la fois</Tab>
      </div>

      {mode === "file" && (
        <div className="card space-y-3">
          <p className="text-sm text-slate-600">
            Vous avez déjà votre liste dans Excel ? Envoyez le fichier tel quel (<b>.xlsx</b> ou <b>.csv</b>) : les colonnes sont reconnues automatiquement
            (Nom, Prénom, Classe, Prix, Quantité…). Vous pourrez vérifier avant d&apos;enregistrer.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileInput} type="file" accept=".xlsx,.csv,.txt,text/csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            <button type="button" className="btn-primary" onClick={() => fileInput.current?.click()}>Choisir le fichier</button>
            <button type="button" className="btn-ghost" onClick={downloadTemplate}>⬇️ Télécharger un modèle à remplir</button>
            {fileName && <span className="text-sm text-slate-500">{fileName}</span>}
          </div>
        </div>
      )}

      {mode === "paste" && (
        <div className="card space-y-3">
          <p className="text-sm text-slate-600">Dans Excel (ou Google Sheets), sélectionnez votre tableau <b>avec la ligne des titres</b>, copiez (Ctrl+C), puis collez ici (Ctrl+V).</p>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={8} className="input font-mono text-xs"
            placeholder={"Nom\tPrénom\tClasse\nKABILA\tJoseph\t6e Primaire A"} />
          <button type="button" className="btn-primary" disabled={!paste.trim()} onClick={() => loadGrid(parseDelimited(paste))}>Analyser le tableau</button>
        </div>
      )}

      {parseError && <div className="card border-red-200 bg-red-50 text-sm text-red-700">{parseError}</div>}

      {mode !== "grid" && grid && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">Vérifiez les colonnes</h2>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> La première ligne contient les titres</label>
          </div>
          <p className="text-xs text-slate-500">Pour chaque colonne de votre fichier, choisissez l&apos;information correspondante (ou « Ignorer »).</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="tbl text-xs">
              <thead>
                <tr>{grid[0].map((h, c) => (
                  <th key={c} className="min-w-[140px] align-top">
                    <div className="mb-1 truncate font-normal text-slate-500">{hasHeader ? h || `Colonne ${c + 1}` : `Colonne ${c + 1}`}</div>
                    <select value={mapping[c] ?? ""} onChange={(e) => setMapping((m) => { const n = [...m]; n[c] = e.target.value; return n; })}
                      className={`input py-1 text-xs ${mapping[c] ? "border-emerald-400" : ""}`}>
                      <option value="">— Ignorer —</option>
                      {fields.map((f) => <option key={f.name} value={f.name} disabled={mapping.includes(f.name) && mapping[c] !== f.name}>{f.label}{f.required ? " *" : ""}</option>)}
                    </select>
                  </th>
                ))}</tr>
              </thead>
              <tbody>
                {(hasHeader ? grid.slice(1) : grid).slice(0, 8).map((r, i) => <tr key={i}>{r.map((v, c) => {
                  const f = fieldByName.get(mapping[c]);
                  const shown = f && (f.type === "date" || f.type === "select" || f.type === "currency") && v ? normalizeImported(f as unknown as Field, v) : v;
                  const label = f?.type === "select" ? f.options?.find((o) => o.value === shown)?.label ?? shown : shown;
                  return <td key={c} className={mapping[c] ? "" : "text-slate-300"}>{f?.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(String(label)) ? String(label).split("-").reverse().join("/") : label}</td>;
                })}</tr>)}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">{rows.length} ligne(s) à importer{(hasHeader ? grid.length - 1 : grid.length) > 8 ? " · aperçu des 8 premières" : ""}.</p>
        </div>
      )}

      {mode === "grid" && (
        <div className="card space-y-3">
          <p className="text-sm text-slate-600">Remplissez une ligne par {singular}. Les lignes vides sont ignorées. Astuce : vous pouvez aussi coller plusieurs cellules copiées depuis Excel dans la première case.</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="tbl text-xs">
              <thead><tr><th>#</th>{gridFields.map((f) => <th key={f.name} className="min-w-[130px]">{f.label}{f.required ? " *" : ""}</th>)}</tr></thead>
              <tbody>
                {manual.map((row, i) => (
                  <tr key={i}>
                    <td className="text-slate-400">{i + 1}</td>
                    {gridFields.map((f, fi) => {
                      const set = (v: string) => setManual((m) => { const n = [...m]; n[i] = { ...n[i], [f.name]: v }; return n; });
                      const v = row[f.name] ?? "";
                      if (f.type === "bool") return <td key={f.name}><input type="checkbox" checked={(row[f.name] ?? f.defaultValue ?? "") === "true"} onChange={(e) => set(e.target.checked ? "true" : "false")} /></td>;
                      if (f.type === "select" || f.type === "currency") {
                        const opts = f.type === "currency" ? [{ value: "USD", label: "USD" }, { value: "CDF", label: "CDF" }] : f.options ?? [];
                        return <td key={f.name}><select value={v || f.defaultValue || ""} onChange={(e) => set(e.target.value)} className="input py-1 text-xs"><option value="">—</option>{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></td>;
                      }
                      return (
                        <td key={f.name}>
                          <input value={v} onChange={(e) => set(e.target.value)} list={f.choices ? `dl-${f.name}` : undefined}
                            type={f.type === "date" ? "date" : f.type === "number" || f.type === "money" ? "text" : "text"} inputMode={f.type === "number" || f.type === "money" ? "decimal" : undefined}
                            className="input py-1 text-xs"
                            onPaste={fi === 0 ? (e) => {
                              const text = e.clipboardData.getData("text");
                              if (!/[\t\n]/.test(text)) return;
                              e.preventDefault();
                              const g = parseDelimited(text);
                              setManual((m) => {
                                const n = [...m];
                                g.forEach((cells, r) => {
                                  const target = { ...(n[i + r] ?? {}) };
                                  cells.forEach((cell, c) => { const fld = gridFields[c]; if (fld) target[fld.name] = cell; });
                                  n[i + r] = target;
                                });
                                return n;
                              });
                            } : undefined} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {fields.filter((f) => f.choices).map((f) => <datalist key={f.name} id={`dl-${f.name}`}>{f.choices!.map((c) => <option key={c} value={c} />)}</datalist>)}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setManual((m) => [...m, ...Array.from({ length: 5 }, () => ({}))])}>+ 5 lignes</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => setManual((m) => [...m, ...Array.from({ length: 20 }, () => ({}))])}>+ 20 lignes</button>
          </div>
        </div>
      )}

      {(mode === "grid" || grid) && (
        <div className="card space-y-3">
          {missingRequired.length > 0 && mode !== "grid" && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Colonne obligatoire non choisie : <b>{missingRequired.map((f) => f.label).join(", ")}</b>.</div>
          )}
          {unknownRefs.map(({ field, names }) => (
            <div key={field.name} className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              {names.length} {field.label.toLowerCase()} pas encore enregistré(e)s : <i>{names.slice(0, 6).join(", ")}{names.length > 6 ? "…" : ""}</i>
              {field.autoCreate
                ? <label className="mt-2 flex items-center gap-2 font-semibold"><input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} /> Créer automatiquement les {field.autoCreate} manquant(e)s</label>
                : <div className="mt-1 text-xs text-amber-700">Ces lignes seront refusées : créez d&apos;abord ces éléments.</div>}
            </div>
          ))}
          {cardType && <p className="text-sm text-slate-600">🪪 Une <b>carte d&apos;identification avec QR code</b> et un matricule (si la colonne est vide) seront créés automatiquement pour chaque personne.</p>}
          <button type="button" className="btn-gold" disabled={pending || !rows.length || (mode !== "grid" && missingRequired.length > 0)} onClick={submit}>
            {pending ? "Enregistrement en cours…" : `Enregistrer ${rows.length} ${rows.length > 1 ? "lignes" : "ligne"}`}
          </button>
        </div>
      )}

      {result && !result.ok && <div className="card border-red-200 bg-red-50 text-sm text-red-700">{result.error}</div>}
      {result && result.ok && (
        <div className="card space-y-3">
          <div className={`text-lg font-bold ${result.errors.length ? "text-amber-700" : "text-emerald-700"}`}>
            {result.inserted ? `✅ ${result.inserted} ${result.inserted > 1 ? "éléments enregistrés" : "élément enregistré"}` : "Aucun élément enregistré"}
            {result.errors.length ? ` · ${result.errors.length} ligne(s) refusée(s)` : ""}
          </div>
          {result.created.map((c) => <p key={c.label} className="text-sm text-slate-600">Créé(e)s automatiquement ({c.label}) : {c.names.join(", ")}</p>)}
          {result.errors.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
              <p className="mb-1 font-semibold text-amber-800">À corriger puis réimporter (seulement ces lignes) :</p>
              <ul className="space-y-0.5 text-amber-900">{result.errors.map((e) => <li key={e.line}>Ligne {e.line} : {e.message}</li>)}</ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Link href={backHref} className="btn-primary">Voir la liste : {title.toLowerCase()}</Link>
            {cardsHref && result.inserted > 0 && <Link href={cardsHref} className="btn-gold">🪪 Voir et imprimer les cartes</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
