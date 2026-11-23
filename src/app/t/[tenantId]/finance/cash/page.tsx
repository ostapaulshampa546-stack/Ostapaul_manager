import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader, StatusBadge, Table, sp } from "@/components/ui";
import { dateTime, money } from "@/lib/format";
import { failIfError, numOrNull, str, withParam } from "@/lib/server-actions";

async function openSession(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant");
  const back = `/t/${tenantId}/finance/cash`;
  const supabase = await createClient();
  const { error } = await supabase.from("cash_sessions").insert({
    tenant_id: tenantId, register_name: str(fd, "register_name") || "Caisse principale",
    currency: str(fd, "currency") === "CDF" ? "CDF" : "USD", opening_float: numOrNull(fd, "opening_float") ?? 0,
  });
  await failIfError(supabase, tenantId, error, "insert:cash_sessions", back);
  revalidatePath(back);
  redirect(withParam(back, "success", "Caisse ouverte."));
}

async function closeSession(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant");
  const back = `/t/${tenantId}/finance/cash`;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("close_cash_session", { p_session: str(fd, "id"), p_counted: numOrNull(fd, "counted"), p_notes: str(fd, "notes") || null });
  await failIfError(supabase, tenantId, error, "close_cash_session", back);
  const d = Number((data as { difference: number }).difference);
  redirect(withParam(back, d === 0 ? "success" : "error", d === 0 ? "Caisse clôturée sans écart." : `Caisse clôturée avec un écart de ${d}. Une alerte a été créée si l'écart dépasse la tolérance.`));
}

export default async function Cash({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("cash.manage")) return <Empty>Accès réservé aux caissiers et à la direction.</Empty>;
  const supabase = await createClient();
  const { data: sessions } = await supabase.from("cash_sessions").select("*").eq("tenant_id", tenantId).order("opened_at", { ascending: false }).limit(60);
  const open = (sessions ?? []).filter((s) => s.status === "open");
  const totals = await Promise.all(open.map(async (s) => {
    const { data } = await supabase.from("payments").select("amount, currency").eq("cash_session_id", s.id).eq("status", "succeeded");
    return (data ?? []).filter((p) => p.currency === s.currency).reduce((a, p) => a + Number(p.amount), 0);
  }));
  const canOpen = ctx.active && (ctx.has("multi_cash") || open.length === 0);
  return (
    <div>
      <PageHeader title="Caisse & clôture journalière" subtitle="Ouvrez une caisse avant d'encaisser des espèces. À la clôture, le montant compté est comparé au montant attendu." />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {open.map((s, i) => (
            <form key={s.id} action={closeSession} className="card">
              <input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="id" value={s.id} />
              <div className="flex items-center justify-between"><h2 className="font-bold">{s.register_name}</h2><StatusBadge status="open" /></div>
              <p className="text-sm text-slate-500">Ouverte le {dateTime(s.opened_at)} · fonds de caisse {money(s.opening_float, s.currency)}</p>
              <p className="mt-2 text-sm">Espèces encaissées : <strong>{money(totals[i], s.currency)}</strong> · Attendu en caisse : <strong>{money(Number(s.opening_float) + totals[i], s.currency)}</strong></p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div><label className="label">Montant compté ({s.currency})</label><input name="counted" type="number" step="0.01" min="0" required className="input" /></div>
                <div className="sm:col-span-2"><label className="label">Notes</label><input name="notes" className="input" /></div>
              </div>
              <button className="btn-dark mt-3">Clôturer la caisse</button>
            </form>
          ))}
          <Table head={["Caisse", "Ouverture", "Clôture", "Attendu", "Compté", "Électronique", "Écart"]}>
            {(sessions ?? []).filter((s) => s.status === "closed").map((s) => (
              <tr key={s.id}>
                <td>{s.register_name}</td><td>{dateTime(s.opened_at)}</td><td>{dateTime(s.closed_at)}</td>
                <td>{money(s.expected_cash, s.currency)}</td><td>{money(s.counted_cash, s.currency)}</td><td>{money(s.electronic_total, ctx.tenant.base_currency)}</td>
                <td className={Number(s.difference) === 0 ? "text-emerald-700" : "font-bold text-red-600"}>{money(s.difference, s.currency)}</td>
              </tr>
            ))}
          </Table>
        </div>
        {canOpen ? (
          <form action={openSession} className="card h-fit space-y-3">
            <h2 className="font-bold">Ouvrir une caisse</h2>
            <input type="hidden" name="tenant" value={tenantId} />
            <div><label className="label">Nom</label><input name="register_name" defaultValue={open.length ? `Caisse ${open.length + 1}` : "Caisse principale"} className="input" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label">Fonds initial</label><input name="opening_float" type="number" step="0.01" min="0" defaultValue={0} className="input" /></div>
              <div><label className="label">Devise</label><select name="currency" defaultValue={ctx.tenant.base_currency} className="input"><option>USD</option><option>CDF</option></select></div>
            </div>
            <button className="btn-primary w-full">Ouvrir</button>
          </form>
        ) : <div className="card h-fit text-sm text-slate-500">Une caisse est déjà ouverte. La gestion multi-caisses est disponible à partir de la formule Standard.</div>}
      </div>
    </div>
  );
}
