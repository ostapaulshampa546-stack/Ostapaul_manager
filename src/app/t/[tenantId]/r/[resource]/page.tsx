import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { getResource, type Field } from "@/lib/resources";
import { Empty, Flash, Locked, PageHeader, StatusBadge, sp } from "@/components/ui";
import { date, money, num } from "@/lib/format";
import { TIER_LABEL, requiredTierFor, FEATURE_LABELS } from "@/lib/plans";
import { saveResource, deleteResource } from "../actions";
import { decryptForDisplay } from "@/lib/crypto";
import { IMPORTABLE } from "@/lib/import-config";

type Row = Record<string, unknown> & { id: string };
const PAGE = 50;

function labelOf(row: Record<string, unknown> | undefined, cols: string[]) {
  if (!row) return "—";
  return cols.map((c) => row[c]).filter(Boolean).join(" ");
}

function display(f: Field, row: Row, rel: Record<string, Map<string, string>>) {
  const v = row[f.name];
  if (v === null || v === undefined || v === "") return <span className="text-slate-300">—</span>;
  switch (f.type) {
    case "bool": return v ? "✓" : "—";
    case "money": return money(v as number, (row.currency as string) || (row.salary_currency as string) || "USD");
    case "number": return num(v as number, 2);
    case "date": return date(v as string);
    case "time": return String(v).slice(0, 5);
    case "relation": return rel[f.name]?.get(String(v)) ?? "—";
    case "select": {
      if (f.name === "status") return <StatusBadge status={String(v)} />;
      return f.options?.find((o) => o.value === String(v))?.label ?? String(v);
    }
    default: return String(v);
  }
}

function Input({ f, value, relOptions }: { f: Field; value: unknown; relOptions?: { id: string; label: string }[] }) {
  const v = value === null || value === undefined ? f.defaultValue ?? "" : String(value);
  const common = { id: f.name, name: f.name, required: f.required, className: "input" };
  switch (f.type) {
    case "textarea": return <textarea {...common} defaultValue={v} rows={3} />;
    case "bool": return <input type="checkbox" name={f.name} defaultChecked={value === undefined ? f.defaultValue === "true" : Boolean(value)} className="h-5 w-5" />;
    case "select": return (
      <select {...common} defaultValue={v}>
        {!f.required && <option value="">—</option>}
        {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
    case "currency": return <select {...common} defaultValue={v || "USD"}><option value="USD">USD ($)</option><option value="CDF">CDF (FC)</option></select>;
    case "relation": return (
      <select {...common} defaultValue={v}>
        <option value="">—</option>
        {relOptions?.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    );
    case "money": return <input {...common} type="number" step="0.01" min="0" defaultValue={v} inputMode="decimal" />;
    case "number": return <input {...common} type="number" step="any" min={f.min} max={f.max} defaultValue={v} inputMode="decimal" />;
    default: return <input {...common} type={f.type === "tel" ? "tel" : f.type} defaultValue={v} />;
  }
}

export default async function ResourcePage({ params, searchParams }: {
  params: Promise<{ tenantId: string; resource: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId, resource } = await params;
  const q = await searchParams;
  const res = getResource(resource);
  if (!res) notFound();
  const ctx = await getTenantContext(tenantId);
  if (!res.sectors.includes(ctx.tenant.sector)) notFound();
  if (res.readPerm && !ctx.can(res.readPerm) && !ctx.can(res.writePerm)) {
    return <Empty>Vous n&apos;avez pas accès à cette rubrique.</Empty>;
  }
  if (res.feature && !ctx.has(res.feature)) {
    return <><PageHeader title={res.title} /><Locked feature={FEATURE_LABELS[res.feature] ?? res.feature} tenantId={tenantId} tierLabel={TIER_LABEL[requiredTierFor(res.feature)]} /></>;
  }
  const supabase = await createClient();
  const search = sp(q.q)?.trim();
  const page = Math.max(0, Number(sp(q.page) ?? 0) || 0);
  let query = supabase.from(res.table).select("*", { count: "exact" }).eq("tenant_id", tenantId)
    .order(res.orderBy.column, { ascending: res.orderBy.ascending }).range(page * PAGE, page * PAGE + PAGE - 1);
  if (search && res.search) {
    const safe = search.replace(/[%,()*]/g, " ").slice(0, 60);
    query = query.or(res.search.map((c) => `${c}.ilike.%${safe}%`).join(","));
  }
  const relFields = res.fields.filter((f) => f.type === "relation" && f.relation);
  const [{ data: rows, count, error }, ...relResults] = await Promise.all([
    query,
    ...relFields.map((f) => {
      let rq = supabase.from(f.relation!.table).select(["id", ...f.relation!.labelColumns].join(",")).eq("tenant_id", tenantId).limit(1000);
      for (const [k, val] of Object.entries(f.relation!.filter ?? {})) rq = rq.eq(k, val);
      return rq;
    }),
  ]);
  const sensitive = res.fields.filter((f) => f.sensitive).map((f) => f.name);
  const decryptRow = <T extends Record<string, unknown> | null | undefined>(r: T): T => {
    if (!r || !sensitive.length) return r;
    const copy: Record<string, unknown> = { ...r };
    for (const k of sensitive) if (copy[k] != null) copy[k] = decryptForDisplay(copy[k]);
    return copy as T;
  };
  const rel: Record<string, Map<string, string>> = {};
  const relOpts: Record<string, { id: string; label: string }[]> = {};
  relFields.forEach((f, i) => {
    const list = ((relResults[i].data ?? []) as unknown as Record<string, unknown>[]).map((r) => ({ id: String(r.id), label: labelOf(r, f.relation!.labelColumns) }));
    relOpts[f.name] = list.sort((a, b) => a.label.localeCompare(b.label));
    rel[f.name] = new Map(list.map((o) => [o.id, o.label]));
  });

  const editId = sp(q.edit);
  const creating = sp(q.new) === "1";
  const canWrite = ctx.can(res.writePerm) && ctx.active;
  const editing = decryptRow(editId ? (rows as Row[] | null)?.find((r) => r.id === editId) ??
    (await supabase.from(res.table).select("*").eq("id", editId).eq("tenant_id", tenantId).maybeSingle()).data as Row | null : null);
  const listFields = res.fields.filter((f) => f.list);
  const base = `/t/${tenantId}/r/${res.key}`;
  const total = count ?? 0;

  return (
    <div>
      <PageHeader
        title={res.title}
        subtitle={res.description ?? `${total} élément(s)`}
        actions={<>
          {res.cardType && <Link href={`/t/${tenantId}/cards?type=${res.cardType}`} className="btn-ghost">🪪 Cartes QR</Link>}
          {res.key === "dining_tables" && <Link href={`/t/${tenantId}/restaurant/tables-qr`} className="btn-ghost">🖨️ Imprimer les QR</Link>}
          {ctx.has("export") && <a href={`/api/export/${res.key}?tenant=${tenantId}`} className="btn-ghost">⬇️ Excel (CSV)</a>}
          {canWrite && IMPORTABLE.has(res.key) && <Link href={`${base}/import`} className="btn-ghost">📥 Ajouter plusieurs / Importer</Link>}
          {canWrite && <Link href={`${base}?new=1`} className="btn-primary">+ Ajouter</Link>}
        </>}
      />
      <Flash error={sp(q.error) ?? (error ? error.message : null)} success={sp(q.success)} />

      {(creating || editing) && canWrite && (
        <form action={saveResource} className="card mb-6">
          <input type="hidden" name="_tenant" value={tenantId} />
          <input type="hidden" name="_resource" value={res.key} />
          {editing && <input type="hidden" name="_id" value={editing.id} />}
          <h2 className="mb-4 text-lg font-bold">{editing ? `Modifier ${res.singular}` : `Nouveau ${res.singular}`}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {res.fields.filter((f) => !(editing && f.name === "qty_on_hand")).map((f) => (
              <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2 lg:col-span-3" : ""}>
                <label htmlFor={f.name} className="label">{f.label}{f.required && " *"}{f.sensitive && <span title="Donnée chiffrée" className="ml-1 normal-case">🔒</span>}</label>
                <Input f={f} value={editing?.[f.name]} relOptions={relOpts[f.name]} />
                {f.hint && <p className="mt-1 text-xs text-slate-400">{f.hint}</p>}
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <button className="btn-primary">Enregistrer</button>
            <Link href={base} className="btn-ghost">Annuler</Link>
          </div>
        </form>
      )}

      {res.search && (
        <form className="no-print mb-4 flex gap-2">
          <input name="q" defaultValue={search} placeholder="Rechercher…" className="input max-w-sm" />
          <button className="btn-ghost">Rechercher</button>
        </form>
      )}

      {rows && rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="tbl">
            <thead><tr>{listFields.map((f) => <th key={f.name}>{f.label}</th>)}<th className="no-print text-right">Actions</th></tr></thead>
            <tbody>
              {(rows as Row[]).map(decryptRow).map((r) => (
                <tr key={r.id}>
                  {listFields.map((f) => <td key={f.name}>{display(f, r, rel)}</td>)}
                  <td className="no-print whitespace-nowrap text-right">
                    {res.rowActions?.filter((a) => a.href.includes("{id}")).map((a) => (
                      <Link key={a.label} href={`/t/${tenantId}${a.href.replace("{id}", r.id)}`} className="btn-ghost btn-sm mr-1">{a.label}</Link>
                    ))}
                    {res.cardType && <Link href={`/t/${tenantId}/cards?type=${res.cardType}&id=${r.id}`} className="btn-ghost btn-sm mr-1">Carte</Link>}
                    {canWrite && <Link href={`${base}?edit=${r.id}`} className="btn-ghost btn-sm mr-1">Modifier</Link>}
                    {canWrite && (
                      <form action={deleteResource} className="inline">
                        <input type="hidden" name="_tenant" value={tenantId} />
                        <input type="hidden" name="_resource" value={res.key} />
                        <input type="hidden" name="_id" value={r.id} />
                        <button className="btn-sm btn text-red-600 hover:bg-red-50" title="Supprimer">✕</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty>Aucun élément pour le moment.{canWrite && <> <Link href={`${base}?new=1`} className="font-semibold text-electric-600">Ajouter le premier</Link>
          {IMPORTABLE.has(res.key) && <> ou <Link href={`${base}/import`} className="font-semibold text-electric-600">importer toute votre liste (Excel, copier-coller)</Link></>}</>}</Empty>
      )}

      {total > PAGE && (
        <div className="no-print mt-4 flex items-center gap-2 text-sm">
          {page > 0 && <Link className="btn-ghost btn-sm" href={`${base}?page=${page - 1}${search ? `&q=${encodeURIComponent(search)}` : ""}`}>← Précédent</Link>}
          <span>Page {page + 1} / {Math.ceil(total / PAGE)}</span>
          {(page + 1) * PAGE < total && <Link className="btn-ghost btn-sm" href={`${base}?page=${page + 1}${search ? `&q=${encodeURIComponent(search)}` : ""}`}>Suivant →</Link>}
        </div>
      )}
    </div>
  );
}
