import { Badge, Card, Flash, Input, PageHeader, Table } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { getI18n } from "@/lib/i18n";
import { requireAdmin } from "@/lib/session";
import { saveCountry, saveCurrency, toggleCountry } from "../actions";

export default async function Countries({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const { t, locale } = await getI18n();
  const [{ data: countries }, { data: currencies }] = await Promise.all([
    s.supabase.from("countries").select("code, name_fr, name_en, currency_code, phone_prefix, active").order(locale === "fr" ? "name_fr" : "name_en"),
    s.supabase.from("currencies").select("code, name, symbol, decimals").order("code"),
  ]);
  return (
    <>
      <PageHeader title={t.admin.countries} subtitle={`${countries?.filter((c) => c.active).length ?? 0} / ${countries?.length ?? 0} · ${t.admin.activeCountry}`} />
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Table head={[t.admin.code, t.common.country, t.admin.currency, t.admin.prefix, t.common.status, ""]}>
          {(countries ?? []).map((c) => (
            <tr key={c.code}>
              <td className="font-mono text-sm">{c.code}</td>
              <td>{locale === "fr" ? c.name_fr : c.name_en}</td>
              <td className="font-mono text-sm">{c.currency_code}</td>
              <td className="text-sm">{c.phone_prefix}</td>
              <td>{c.active ? <Badge tone="green">{t.admin.activeCountry}</Badge> : <Badge>—</Badge>}</td>
              <td className="text-right">
                <form action={toggleCountry}>
                  <input type="hidden" name="code" value={c.code} /><input type="hidden" name="active" value={c.active ? "false" : "true"} />
                  <SubmitButton size="sm" variant={c.active ? "ghost" : "primary"}>{c.active ? t.admin.close : t.admin.reactivate}</SubmitButton>
                </form>
              </td>
            </tr>
          ))}
        </Table>
        <div className="space-y-6">
          <Card title={`${t.common.add} / ${t.common.edit} — ${t.common.country}`}>
            <form action={saveCountry} className="grid gap-3 sm:grid-cols-2">
              <Input label={t.admin.code} name="code" required pattern="[A-Za-z]{2}" maxLength={2} placeholder="NG" />
              <Input label={t.admin.prefix} name="phone_prefix" required pattern="\+[0-9]{1,4}" placeholder="+234" />
              <Input label="Nom (FR)" name="name_fr" required />
              <Input label="Name (EN)" name="name_en" required />
              <label className="block sm:col-span-2"><span className="field-label">{t.admin.currency}</span>
                <select name="currency_code" className="field-input">{(currencies ?? []).map((c) => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}</select>
              </label>
              <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="active" className="h-5 w-5 accent-royal-600" /> {t.admin.activeCountry}</label>
              <div className="sm:col-span-2"><SubmitButton>{t.common.save}</SubmitButton></div>
            </form>
          </Card>
          <Card title={t.admin.addCurrency}>
            <form action={saveCurrency} className="grid gap-3 sm:grid-cols-2">
              <Input label={t.admin.code} name="code" required pattern="[A-Za-z]{3}" maxLength={3} placeholder="NGN" />
              <Input label={t.admin.symbol} name="symbol" required maxLength={8} placeholder="₦" />
              <Input label={t.common.name} name="name" required />
              <Input label={t.admin.decimals} name="decimals" type="number" min={0} max={3} defaultValue="2" required />
              <div className="sm:col-span-2"><SubmitButton>{t.common.save}</SubmitButton></div>
            </form>
            <p className="mt-4 text-xs text-muted">{(currencies ?? []).map((c) => `${c.code} ${c.symbol}`).join(" · ")}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
