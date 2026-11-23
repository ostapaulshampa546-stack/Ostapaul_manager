import Link from "next/link";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { str } from "@/lib/server-actions";

async function markAll(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant");
  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("tenant_id", tenantId).is("read_at", null);
  redirect(`/t/${tenantId}/notifications`);
}

export default async function Notifications({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  await getTenantContext(tenantId);
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100);
  return (
    <div>
      <PageHeader title="Notifications" subtitle="Alertes de stock, rapports quotidiens, abonnement, commandes QR, sécurité…"
        actions={<form action={markAll}><input type="hidden" name="tenant" value={tenantId} /><button className="btn-ghost">Tout marquer comme lu</button></form>} />
      {data?.length ? (
        <ul className="space-y-2">
          {data.map((n) => (
            <li key={n.id} className={`card flex gap-3 py-3 ${n.read_at ? "opacity-60" : "border-l-4 border-l-electric-600"}`}>
              <div className="flex-1"><div className="font-semibold">{n.title}</div>{n.body && <div className="text-sm text-slate-600">{n.body}</div>}
                <div className="text-xs text-slate-400">{dateTime(n.created_at)}</div></div>
              {n.link && <Link href={`/t/${tenantId}${n.link}`} className="btn-ghost btn-sm h-fit">Ouvrir</Link>}
            </li>
          ))}
        </ul>
      ) : <Empty>Aucune notification.</Empty>}
    </div>
  );
}
