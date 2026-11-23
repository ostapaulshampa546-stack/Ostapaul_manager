import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Flash, PageHeader, StatusBadge, sp } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { failIfError, str, withParam } from "@/lib/server-actions";

async function create(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"); const back = `/t/${tenantId}/support`;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("support_tickets").insert({ tenant_id: tenantId, subject: str(fd, "subject"), body: str(fd, "body"), created_by: user?.id });
  await failIfError(supabase, tenantId, error, "insert:support_tickets", back);
  redirect(withParam(back, "success", "Demande envoyée à l'équipe OSTAPAUL."));
}
async function reply(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"); const back = `/t/${tenantId}/support`;
  const supabase = await createClient();
  const { error } = await supabase.from("support_messages").insert({ ticket_id: str(fd, "ticket"), body: str(fd, "body") });
  await failIfError(supabase, tenantId, error, "insert:support_messages", back);
  redirect(back);
}

export default async function Support({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  const supabase = await createClient();
  const { data: tickets } = await supabase.from("support_tickets").select("*, support_messages(id, body, is_staff, created_at)").eq("tenant_id", tenantId).order("created_at", { ascending: false });
  const level = ctx.has("support_vip") ? "Assistance VIP" : ctx.has("support_priority") ? "Support prioritaire" : "Support par e-mail";
  return (
    <div>
      <PageHeader title="Assistance technique" subtitle={`Votre niveau : ${level}`} />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="grid gap-4 lg:grid-cols-3">
        <form action={create} className="card h-fit space-y-3">
          <input type="hidden" name="tenant" value={tenantId} />
          <div><label className="label">Sujet</label><input name="subject" required minLength={3} maxLength={200} className="input" /></div>
          <div><label className="label">Description</label><textarea name="body" required rows={5} maxLength={5000} className="input" /></div>
          <button className="btn-primary w-full">Envoyer la demande</button>
        </form>
        <div className="space-y-3 lg:col-span-2">
          {(tickets ?? []).map((t) => (
            <details key={t.id} className="card" open={t.status !== "closed"}>
              <summary className="flex cursor-pointer items-center justify-between gap-2"><span className="font-semibold">{t.subject}</span>
                <span className="flex gap-2"><span className="badge bg-slate-100">{t.priority}</span><StatusBadge status={t.status === "in_progress" ? "pending" : t.status === "closed" ? "closed" : "open"} /></span></summary>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{t.body}</p>
              <ul className="mt-3 space-y-2">
                {((t.support_messages ?? []) as { id: string; body: string; is_staff: boolean; created_at: string }[]).sort((a, b) => a.created_at.localeCompare(b.created_at)).map((m) => (
                  <li key={m.id} className={`rounded-lg p-2 text-sm ${m.is_staff ? "bg-electric-100" : "bg-slate-50"}`}><div className="text-xs font-semibold">{m.is_staff ? "Équipe OSTAPAUL" : "Vous"} · {dateTime(m.created_at)}</div>{m.body}</li>
                ))}
              </ul>
              {t.status !== "closed" && <form action={reply} className="mt-2 flex gap-2"><input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="ticket" value={t.id} /><input name="body" required className="input" placeholder="Répondre…" /><button className="btn-ghost">Envoyer</button></form>}
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
