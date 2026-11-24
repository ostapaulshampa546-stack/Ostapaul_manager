import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { str } from "@/lib/server-actions";

const STATUS: Record<string, string> = { new: "🆕 Nouveau", contacted: "📞 Contacté", won: "✅ Client", lost: "✕ Sans suite" };
const SECTOR: Record<string, string> = { restaurant: "Restaurant", school: "École", pme: "PME", other: "Autre" };

async function update(fd: FormData) {
  "use server";
  const supabase = await createClient();
  const status = str(fd, "status");
  await supabase.from("leads").update({ status: STATUS[status] ? status : "new", notes: str(fd, "notes") || null }).eq("id", str(fd, "id"));
  redirect("/admin/leads");
}

export default async function Leads({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const q = await searchParams;
  const supabase = await createClient();
  let lq = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(300);
  if (q.status) lq = lq.eq("status", q.status);
  const { data } = await lq;
  return (
    <div>
      <PageHeader title="Demandes de contact" subtitle="Prospects venus du formulaire du site. Recontactez-les et suivez leur statut." />
      <div className="mb-4 flex flex-wrap gap-2">
        <a href="?" className={!q.status ? "btn-dark btn-sm" : "btn-ghost btn-sm"}>Toutes</a>
        {Object.entries(STATUS).map(([k, v]) => <a key={k} href={`?status=${k}`} className={q.status === k ? "btn-dark btn-sm" : "btn-ghost btn-sm"}>{v}</a>)}
      </div>
      {!data?.length ? <Empty>Aucune demande pour le moment.</Empty> : (
        <div className="space-y-3">
          {data.map((l) => {
            const wa = (l.phone ?? "").replace(/\D/g, "");
            return (
              <div key={l.id} className="card">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-bold">{l.name}{l.organization ? ` — ${l.organization}` : ""}</div>
                    <div className="text-xs text-slate-500">{dateTime(l.created_at)}{l.sector ? ` · ${SECTOR[l.sector]}` : ""}</div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {l.phone && <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="btn-ghost btn-sm">📞 {l.phone}</a>}
                    {wa.length >= 9 && <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">💬 WhatsApp</a>}
                    {l.email && <a href={`mailto:${l.email}`} className="btn-ghost btn-sm">✉️ {l.email}</a>}
                  </div>
                </div>
                {l.message && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{l.message}</p>}
                <form action={update} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={l.id} />
                  <select name="status" defaultValue={l.status} className="input w-auto py-1 text-sm">{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <input name="notes" defaultValue={l.notes ?? ""} placeholder="Notes internes" className="input flex-1 py-1 text-sm" />
                  <button className="btn-ghost btn-sm">Enregistrer</button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
