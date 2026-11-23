import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, Locked, PageHeader, sp } from "@/components/ui";
import { dateTime } from "@/lib/format";
import { failIfError, str, withParam } from "@/lib/server-actions";

const META: Record<string, { label: string; desc: string; feature: string; sectors?: string[] }> = {
  payment_reminder: { label: "Rappels de paiement", desc: "Frais scolaires échus → SMS/WhatsApp aux parents (1 rappel / 7 jours). Factures clients en retard → notification.", feature: "automation" },
  parent_notification: { label: "Notifications aux parents", desc: "Absence de la veille et confirmation de paiement par SMS/WhatsApp.", feature: "automation", sectors: ["school"] },
  stock_alert: { label: "Alertes de stock", desc: "Résumé quotidien des produits sous le seuil.", feature: "notifications", sectors: ["restaurant", "pme"] },
  daily_report: { label: "Rapport quotidien", desc: "Recettes, dépenses et résultat de la veille.", feature: "notifications" },
  finance_alert: { label: "Alertes financières", desc: "Avertit lorsque les dépenses dépassent les recettes.", feature: "notifications" },
  subscription_renewal: { label: "Renouvellement d'abonnement", desc: "Facture et rappel 3 jours avant l'échéance.", feature: "notifications" },
};

async function toggle(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"); const back = `/t/${tenantId}/automations`;
  const supabase = await createClient();
  const { error } = await supabase.from("automations").update({ enabled: str(fd, "enabled") === "1" }).eq("id", str(fd, "id")).eq("tenant_id", tenantId);
  await failIfError(supabase, tenantId, error, "update:automations", back);
  redirect(withParam(back, "success", "Automatisation mise à jour."));
}

export default async function Automations({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.has("notifications")) return <Locked feature="Notifications automatiques" tenantId={tenantId} tierLabel="Standard" />;
  const supabase = await createClient();
  const { data } = await supabase.from("automations").select("*").eq("tenant_id", tenantId);
  const list = (data ?? []).filter((a) => !META[a.kind].sectors || META[a.kind].sectors!.includes(ctx.tenant.sector));
  return (
    <div>
      <PageHeader title="Automatisations intelligentes" subtitle="Exécutées chaque jour par le planificateur de la plateforme." />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      {!list.length ? <Empty>Aucune automatisation.</Empty> : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((a) => {
            const m = META[a.kind]; const available = ctx.has(m.feature);
            return (
              <div key={a.id} className="card">
                <div className="flex items-start justify-between gap-2">
                  <div><div className="font-bold">{m.label}</div><p className="text-sm text-slate-500">{m.desc}</p>
                    <p className="mt-1 text-xs text-slate-400">Dernière exécution : {dateTime(a.last_run_at)}</p></div>
                  {available ? (
                    <form action={toggle}><input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="id" value={a.id} /><input type="hidden" name="enabled" value={a.enabled ? "0" : "1"} />
                      <button className={a.enabled ? "btn-primary btn-sm" : "btn-ghost btn-sm"} disabled={!ctx.can("settings.write")}>{a.enabled ? "Activée" : "Désactivée"}</button></form>
                  ) : <span className="badge bg-gold-100 text-navy-900">Premium</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
