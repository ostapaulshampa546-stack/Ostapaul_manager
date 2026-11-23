"use client";
import { useState } from "react";

type Extracted = { document_type: string; vendor: string | null; date: string | null; total: number | null; currency: string | null; tax: number | null;
  items: { description: string; quantity: number | null; unit_price: number | null; total: number | null }[]; suggested_category: string; notes: string };

export function OcrScanner({ tenantId, save, canSave }: { tenantId: string; save: (fd: FormData) => Promise<void>; canSave: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<Extracted | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function onFile(file: File) {
    setErr(null); setData(null); setBusy(true);
    setPreview(URL.createObjectURL(file));
    const fd = new FormData(); fd.append("tenant", tenantId); fd.append("file", file);
    try {
      const r = await fetch("/api/ocr", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) setErr(j.error); else setData(j.extracted);
    } catch { setErr("Connexion impossible."); } finally { setBusy(false); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-8 text-center hover:border-electric-600">
          <span className="text-4xl">📸</span><span className="mt-2 font-semibold">Prendre une photo ou choisir une image</span><span className="text-xs text-slate-500">JPEG, PNG ou WebP · 5 Mo max</span>
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        {preview && <img src={preview} alt="Document" className="mt-3 max-h-96 w-full rounded-lg object-contain" />}
      </div>
      <div className="card">
        {busy && <p className="text-sm text-slate-500">Lecture du document…</p>}
        {err && <p className="text-sm text-red-600">{err}</p>}
        {data && (
          <form action={save} className="space-y-3">
            <input type="hidden" name="tenant" value={tenantId} />
            <h2 className="font-bold">Vérifiez avant d&apos;enregistrer</h2>
            {data.notes && <p className="rounded bg-amber-50 p-2 text-xs text-amber-800">⚠ {data.notes}</p>}
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Montant total</label><input name="amount" type="number" step="0.01" defaultValue={data.total ?? ""} required className="input" /></div>
              <div><label className="label">Devise</label><select name="currency" defaultValue={data.currency ?? "USD"} className="input"><option>USD</option><option>CDF</option></select></div>
              <div><label className="label">Date</label><input name="date" type="date" defaultValue={data.date ?? ""} className="input" /></div>
              <div><label className="label">Catégorie</label><input name="category" defaultValue={data.suggested_category} className="input" /></div>
            </div>
            <div><label className="label">Description</label><input name="description" defaultValue={`${data.document_type} ${data.vendor ?? ""}`.trim()} className="input" /></div>
            <div><label className="label">Statut</label><select name="status" className="input"><option value="paid">Payée</option><option value="unpaid">À payer</option></select></div>
            {!!data.items.length && (
              <table className="tbl text-xs"><thead><tr><th>Ligne</th><th>Qté</th><th>P.U.</th><th>Total</th></tr></thead>
                <tbody>{data.items.map((i, k) => <tr key={k}><td>{i.description}</td><td>{i.quantity ?? "—"}</td><td>{i.unit_price ?? "—"}</td><td>{i.total ?? "—"}</td></tr>)}</tbody></table>
            )}
            {canSave ? <button className="btn-primary w-full">Valider et enregistrer la dépense</button> : <p className="text-xs text-slate-500">Permission « finances » requise pour enregistrer.</p>}
          </form>
        )}
        {!busy && !data && !err && <p className="text-sm text-slate-500">Les données extraites apparaîtront ici.</p>}
      </div>
    </div>
  );
}
