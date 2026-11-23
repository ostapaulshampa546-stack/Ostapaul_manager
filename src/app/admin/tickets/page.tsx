import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatusBadge } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { str } from "@/lib/server-actions";

async function reply(fd: FormData) {
  "use server";
  const supabase = await createClient();
  if (str(fd, "body")) await supabase.from("support_messages").insert({ ticket_id: str(fd, "ticket"), body: str(fd, "body") });
  if (fd.get("close") === "on") await supabase.from("support_tickets").update({ status: "closed" }).eq("id", str(fd, "ticket"));
  redirect("/admin/tickets");
}

export default async function Tickets() {
  const supabase = await createClient();
  const { data } = await supabase.from("support_tickets").select("*, tenants(name), support_messages(id, body, is_staff, created_at)").order("status").order("created_at", { ascending: false }).limit(200);
  const prio = { vip: 0, priority: 1, normal: 2 } as Record<string, number>;
  const list = (data ?? []).sort((a, b) => (a.status === "closed" ? 1 : 0) - (b.status === "closed" ? 1 : 0) || prio[a.priority] - prio[b.priority]);
  return (
    <div>
      <PageHeader title="Demandes d'assistance" subtitle="Triées par priorité (VIP, prioritaire, normal)." />
      <div className="space-y-3">
        {list.map((t) => (
          <details key={t.id} className="card" open={t.status !== "closed"}>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
              <span><strong>{t.subject}</strong> <span className="text-sm text-slate-500">— {(t.tenants as { name: string }).name} · {dateTime(t.created_at)}</span></span>
              <span className="flex gap-1"><span className={`badge ${t.priority === "vip" ? "bg-gold-100 text-navy-900" : t.priority === "priority" ? "bg-electric-100 text-electric-600" : "bg-slate-100"}`}>{t.priority}</span><StatusBadge status={t.status === "closed" ? "closed" : "open"} /></span>
            </summary>
            <p className="mt-2 whitespace-pre-wrap text-sm">{t.body}</p>
            <ul className="mt-2 space-y-1">{((t.support_messages ?? []) as { id: string; body: string; is_staff: boolean; created_at: string }[]).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((m) =>
              <li key={m.id} className={`rounded p-2 text-sm ${m.is_staff ? "bg-electric-100" : "bg-slate-50"}`}>{m.is_staff ? "Équipe" : "Client"} : {m.body}</li>)}</ul>
            {t.status !== "closed" && <form action={reply} className="mt-2 flex flex-wrap gap-2"><input type="hidden" name="ticket" value={t.id} /><input name="body" className="input flex-1" placeholder="Réponse" />
              <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="close" /> clôturer</label><button className="btn-primary">Envoyer</button></form>}
          </details>
        ))}
      </div>
    </div>
  );
}
