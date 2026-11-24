import { Badge, Card, Flash, Input, PageHeader, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { getI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/public-data";
import { requireAdmin } from "@/lib/session";
import { removePrice, savePlan, setPrice } from "../actions";

export default async function Plans({ searchParams }: { searchParams: Promise<{ country?: string; ok?: string; error?: string }> }) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const { t, locale } = await getI18n();
  const [{ data: plans }, { data: countries }, { data: prices }, { data: currencies }] = await Promise.all([
    s.supabase.from("plans").select("id, code, audience, name, tagline_fr, tagline_en, features_fr, features_en, limits, is_free, active").order("audience").order("sort_order"),
    s.supabase.from("countries").select("code, name_fr, name_en, currency_code, active").order(locale === "fr" ? "name_fr" : "name_en"),
    s.supabase.from("plan_prices").select("id, plan_id, country_code, currency_code, period, amount"),
    s.supabase.from("currencies").select("code, symbol, decimals"),
  ]);
  const country = (countries ?? []).find((c) => c.code === sp.country?.toUpperCase()) ?? (countries ?? []).find((c) => c.active) ?? countries?.[0];
  const cur = (currencies ?? []).find((c) => c.code === country?.currency_code);
  return (
    <>
      <PageHeader title={t.admin.plans} subtitle={t.pages.pricing.subtitle} />
      <Flash ok={sp.ok} error={sp.error} />
      <form method="get" className="mb-6 flex flex-wrap items-end gap-2">
        <label className="block"><span className="field-label">{t.common.country}</span>
          <select name="country" defaultValue={country?.code} className="field-input w-auto">
            {(countries ?? []).map((c) => <option key={c.code} value={c.code}>{locale === "fr" ? c.name_fr : c.name_en} ({c.currency_code}){c.active ? " ●" : ""}</option>)}
          </select>
        </label>
        <button className="btn btn-ghost">OK</button>
      </form>
      <div className="grid gap-6 lg:grid-cols-2">
        {(plans ?? []).map((p) => {
          const own = (prices ?? []).filter((x) => x.plan_id === p.id && x.country_code === country?.code);
          return (
            <Card key={p.id} title={`${p.name}`} action={<span className="flex gap-1"><Badge tone="blue">{p.audience === "center" ? t.admin.audienceCenter : t.admin.audienceStudent}</Badge>{!p.active && <Badge tone="red">off</Badge>}</span>}>
              <div className="mb-4 rounded-xl bg-mist p-4">
                <p className="mb-2 text-sm font-semibold">{t.admin.prices} — {country?.code}</p>
                {p.is_free ? <p className="text-sm text-muted">{t.pages.pricing.free}</p> : (
                  <>
                    {own.length === 0 && <p className="mb-2 text-sm text-[#7a5300]">{t.pages.pricing.notPublished}</p>}
                    <ul className="mb-3 space-y-1">
                      {own.map((x) => (
                        <li key={x.id} className="flex items-center justify-between text-sm">
                          <span className="font-semibold">{formatMoney(Number(x.amount), cur, locale)} / {t.enums.period[x.period as "month"]}</span>
                          <form action={removePrice}><input type="hidden" name="id" value={x.id} /><input type="hidden" name="from" value={`/admin/plans?country=${country?.code}`} /><SubmitButton size="sm" variant="ghost">{t.admin.removePrice}</SubmitButton></form>
                        </li>
                      ))}
                    </ul>
                    {country && (
                      <form action={setPrice} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="plan_id" value={p.id} /><input type="hidden" name="country_code" value={country.code} />
                        <label className="block"><span className="text-xs font-semibold">{t.admin.amount} ({country.currency_code})</span>
                          <input name="amount" type="number" min={0} step="0.01" required className="field-input w-36 py-1.5" /></label>
                        <select name="period" className="field-input w-auto py-1.5" aria-label={t.admin.period}><option value="month">{t.enums.period.month}</option><option value="year">{t.enums.period.year}</option></select>
                        <SubmitButton size="sm">{t.admin.setPrice}</SubmitButton>
                      </form>
                    )}
                  </>
                )}
              </div>
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-royal-600">{t.common.edit}</summary>
                <form action={savePlan} className="mt-4 grid gap-3">
                  <input type="hidden" name="id" value={p.id} />
                  <Input label={t.common.name} name="name" defaultValue={p.name} required />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input label={`${t.admin.tagline} (FR)`} name="tagline_fr" defaultValue={p.tagline_fr ?? ""} />
                    <Input label={`${t.admin.tagline} (EN)`} name="tagline_en" defaultValue={p.tagline_en ?? ""} />
                    <Textarea label={`${t.admin.features} (FR)`} name="features_fr" defaultValue={(p.features_fr ?? []).join("\n")} rows={4} />
                    <Textarea label={`${t.admin.features} (EN)`} name="features_en" defaultValue={(p.features_en ?? []).join("\n")} rows={4} />
                  </div>
                  <Textarea label={t.admin.limits} name="limits" defaultValue={JSON.stringify(p.limits)} rows={2} hint={t.admin.limitsNote} className="font-mono" />
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} className="h-5 w-5 accent-royal-600" /> {t.admin.active}</label>
                  <SubmitButton>{t.common.save}</SubmitButton>
                </form>
              </details>
            </Card>
          );
        })}
      </div>
    </>
  );
}
