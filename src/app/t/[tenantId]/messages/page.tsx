import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Flash, Locked, PageHeader, StatusBadge, Table, sp } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { failIfError, str, withParam } from "@/lib/server-actions";

async function send(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"); const back = `/t/${tenantId}/messages`;
  const channel = str(fd, "channel") === "whatsapp" ? "whatsapp" : "sms";
  const body = str(fd, "body").slice(0, 1000);
  const target = str(fd, "target");
  if (!body) redirect(withParam(back, "error", "Message vide"));
  const supabase = await createClient();
  let numbers: string[] = [];
  if (target === "custom") numbers = str(fd, "numbers").split(/[\s,;]+/).filter(Boolean);
  else if (target === "employees") numbers = ((await supabase.from("employees").select("phone").eq("tenant_id", tenantId).eq("is_active", true)).data ?? []).map((e) => e.phone);
  else {
    let sq = supabase.from("students").select("guardian_phone, guardian_whatsapp").eq("tenant_id", tenantId).eq("status", "active");
    if (target !== "all_parents") sq = sq.eq("class_id", target);
    numbers = ((await sq).data ?? []).map((s) => (channel === "whatsapp" ? s.guardian_whatsapp ?? s.guardian_phone : s.guardian_phone));
  }
  const uniq = Array.from(new Set(numbers.filter((n): n is string => Boolean(n)).map((n) => n.replace(/[^\d+]/g, "")))).filter((n) => n.length >= 9).slice(0, 2000);
  if (!uniq.length) redirect(withParam(back, "error", "Aucun destinataire avec numéro."));
  const { error } = await supabase.from("message_outbox").insert(uniq.map((to) => ({ tenant_id: tenantId, channel, to_address: to, body })));
  await failIfError(supabase, tenantId, error, "insert:message_outbox", back);
  redirect(withParam(back, "success", `${uniq.length} message(s) mis en file d'envoi.`));
}

export default async function Messages({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.has("sms_whatsapp")) return <Locked feature="Notifications WhatsApp et SMS" tenantId={tenantId} tierLabel="Premium" />;
  const supabase = await createClient();
  const [{ data: outbox }, { data: classes }] = await Promise.all([
    supabase.from("message_outbox").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100),
    ctx.tenant.sector === "school" ? supabase.from("classes").select("id, name").eq("tenant_id", tenantId).order("name") : Promise.resolve({ data: [] }),
  ]);
  return (
    <div>
      <PageHeader title="SMS & WhatsApp" subtitle="Communication avec les parents, étudiants, clients et le personnel. Envoi via le fournisseur configuré sur la plateforme." />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="grid gap-4 lg:grid-cols-3">
        <form action={send} className="card h-fit space-y-3">
          <input type="hidden" name="tenant" value={tenantId} />
          <div><label className="label">Canal</label><select name="channel" className="input"><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select></div>
          <div><label className="label">Destinataires</label><select name="target" className="input">
            {ctx.tenant.sector === "school" && <><option value="all_parents">Tous les parents</option>{(classes ?? []).map((c: { id: string; name: string }) => <option key={c.id} value={c.id}>Parents — {c.name}</option>)}</>}
            <option value="employees">Tout le personnel</option><option value="custom">Numéros saisis</option></select></div>
          <div><label className="label">Numéros (si « saisis »)</label><textarea name="numbers" rows={2} className="input" placeholder="+243810000000, +243990000000" /></div>
          <div><label className="label">Message</label><textarea name="body" rows={4} maxLength={1000} required className="input" /></div>
          <button className="btn-primary w-full">Envoyer</button>
        </form>
        <div className="lg:col-span-2">
          <Table head={["Date", "Canal", "Destinataire", "Message", "Statut"]}>
            {(outbox ?? []).map((m) => <tr key={m.id}><td className="whitespace-nowrap text-xs">{dateTime(m.created_at)}</td><td>{m.channel}</td><td className="font-mono text-xs">{m.to_address}</td>
              <td className="max-w-xs truncate text-xs" title={m.body}>{m.body}</td>
              <td>{m.status === "not_configured" ? <span className="badge bg-slate-100 text-slate-600" title="Aucun fournisseur SMS/WhatsApp configuré">non configuré</span> : <StatusBadge status={m.status === "sent" ? "succeeded" : m.status === "queued" ? "pending" : m.status} />}</td></tr>)}
          </Table>
        </div>
      </div>
    </div>
  );
}
