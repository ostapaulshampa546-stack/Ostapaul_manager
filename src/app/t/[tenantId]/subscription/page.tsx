import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Flash, PageHeader, StatusBadge, Table, sp } from "@/components/ui";
import { PlanComparison } from "@/components/PlanComparison";
import { dateTime, date, money, METHOD_LABELS } from "@/lib/format";
import { TIER_LABEL, type PlanRow } from "@/lib/plans";
import { failIfError, str, withParam } from "@/lib/server-actions";
import { isConfigured } from "@/lib/payments/pawapay";
import { paySubscription } from "./actions";

async function changePlan(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"); const back = `/t/${tenantId}/subscription`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_plan", { p_tenant: tenantId, p_tier: str(fd, "tier") });
  await failIfError(supabase, tenantId, error, "change_plan", back);
  redirect(withParam(back, "success", "Formule modifiée. Réglez la facture pour activer ou renouveler la période."));
}
async function renew(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"); const back = `/t/${tenantId}/subscription`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_renewal_invoice", { p_tenant: tenantId });
  await failIfError(supabase, tenantId, error, "create_renewal_invoice", back);
  redirect(withParam(back, "success", "Facture d'abonnement prête au paiement."));
}
async function toggleCancel(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"); const back = `/t/${tenantId}/subscription`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_subscription", { p_tenant: tenantId, p_cancel: str(fd, "cancel") === "1" });
  await failIfError(supabase, tenantId, error, "cancel_subscription", back);
  redirect(back);
}

export default async function Subscription({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  const supabase = await createClient();
  const billingId = ctx.tenant.parent_id ?? tenantId;
  const [{ data: plans }, { data: sub }, { data: invoices }, { data: pays }] = await Promise.all([
    supabase.from("plans").select("id, sector, tier, name, price_usd, max_extra_users, features").eq("sector", ctx.tenant.sector).eq("is_active", true),
    supabase.from("subscriptions").select("*, plans(name, tier, price_usd)").eq("tenant_id", billingId).maybeSingle(),
    supabase.from("subscription_invoices").select("*, plans(name)").eq("tenant_id", billingId).order("created_at", { ascending: false }),
    supabase.from("payments").select("*").eq("tenant_id", billingId).eq("payable_type", "subscription_invoice").order("created_at", { ascending: false }),
  ]);
  const owner = ctx.tenant.owner_id === ctx.userId && !ctx.tenant.parent_id;
  const unpaid = (invoices ?? []).find((i) => i.status === "unpaid");
  const plan = sub?.plans as { name: string; tier: "basic" | "standard" | "premium"; price_usd: number } | null;
  return (
    <div>
      <PageHeader title="Abonnement & facturation" subtitle={ctx.tenant.parent_id ? "Succursale : l'abonnement est géré par l'établissement principal." : "Choisissez, payez, renouvelez ou changez de formule à tout moment."} />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="card">
          <div className="text-xs font-semibold uppercase text-slate-500">Formule actuelle</div>
          <div className="mt-1 text-2xl font-bold">{plan ? TIER_LABEL[plan.tier] : "—"} <span className="text-base font-medium text-slate-500">· {plan ? `${Number(plan.price_usd)} $ / mois` : ""}</span></div>
          <div className="mt-2"><StatusBadge status={sub?.status} /></div>
          <div className="mt-2 text-sm text-slate-600">
            {sub?.status === "trialing" && <>Essai jusqu&apos;au {dateTime(sub.trial_ends_at)}</>}
            {["active", "past_due"].includes(sub?.status ?? "") && <>Période en cours jusqu&apos;au {dateTime(sub?.current_period_end)}</>}
            {sub?.cancel_at_period_end && <div className="text-red-600">Résiliation à la fin de la période.</div>}
          </div>
          {owner && sub && ["active"].includes(sub.status) && (
            <form action={toggleCancel} className="mt-3"><input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="cancel" value={sub.cancel_at_period_end ? "0" : "1"} />
              <button className="text-xs text-slate-500 underline">{sub.cancel_at_period_end ? "Annuler la résiliation" : "Résilier à la fin de la période"}</button></form>
          )}
        </div>
        <div className="card lg:col-span-2">
          <h2 className="font-bold">Payer / renouveler</h2>
          {!owner ? <p className="mt-2 text-sm text-slate-500">Seul le propriétaire peut gérer le paiement.</p> : unpaid ? (
            <>
              <p className="mt-1 text-sm">Facture <span className="font-mono">{unpaid.number}</span> — <strong>{money(unpaid.amount_usd, "USD")}</strong> · période du {date(unpaid.period_start)} au {date(unpaid.period_end)}</p>
              {isConfigured() ? (
                <form action={paySubscription} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="invoice" value={unpaid.id} />
                  <div><label className="label">Opérateur</label><select name="method" className="input"><option value="orange_money">Orange Money</option><option value="airtel_money">Airtel Money</option><option value="mpesa">M-Pesa</option></select></div>
                  <div><label className="label">Numéro</label><input name="phone" type="tel" required placeholder="08X XXX XXXX" className="input" /></div>
                  <button className="btn-gold">Payer {money(unpaid.amount_usd, "USD")}</button>
                </form>
              ) : <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Paiement Mobile Money en ligne non encore configuré sur la plateforme. Paiement en espèces auprès d&apos;OSTAPAUL : l&apos;administrateur enregistre votre règlement et votre abonnement est activé immédiatement.</p>}
            </>
          ) : (
            <form action={renew} className="mt-3"><input type="hidden" name="tenant" value={tenantId} /><button className="btn-primary">Générer la facture de {sub?.status === "trialing" || sub?.status === "expired" ? "souscription" : "renouvellement"}</button></form>
          )}
        </div>
      </div>
      <h2 className="mb-3 text-lg font-bold">Comparer les formules</h2>
      <PlanComparison plans={(plans ?? []) as PlanRow[]} currentTier={plan?.tier}
        cta={(p) => ({ label: "Choisir", form: owner ? (
          <form action={changePlan}><input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="tier" value={p.tier} />
            <button className={p.tier === "premium" ? "btn-gold w-full" : "btn-primary w-full"}>Passer en {TIER_LABEL[p.tier]}</button></form>
        ) : <span className="text-xs text-slate-400">Propriétaire uniquement</span> })} />
      <h2 className="mb-2 mt-8 text-lg font-bold">Mes factures d&apos;abonnement</h2>
      <Table head={["N°", "Formule", "Période", "Montant", "Statut", "Payée le"]}>
        {(invoices ?? []).map((i) => <tr key={i.id}><td className="font-mono text-xs">{i.number}</td><td>{(i.plans as { name: string }).name}</td><td>{date(i.period_start)} → {date(i.period_end)}</td>
          <td>{money(i.amount_usd, "USD")}</td><td><StatusBadge status={i.status} /></td><td>{dateTime(i.paid_at)}</td></tr>)}
      </Table>
      {!!pays?.length && <>
        <h2 className="mb-2 mt-6 font-bold">Paiements d&apos;abonnement</h2>
        <Table head={["Date", "Référence", "Moyen", "Montant", "Statut"]}>
          {pays.map((p) => <tr key={p.id}><td>{dateTime(p.created_at)}</td><td className="font-mono text-xs">{p.reference}</td><td>{METHOD_LABELS[p.method]}</td><td>{money(p.amount, p.currency)}</td><td><StatusBadge status={p.status} /></td></tr>)}
        </Table>
      </>}
    </div>
  );
}
