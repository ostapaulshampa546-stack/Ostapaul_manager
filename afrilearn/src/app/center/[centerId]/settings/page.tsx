import { Card, Checkbox, Flash, Input, PageHeader, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { getI18n } from "@/lib/i18n";
import { requireCenterManager } from "@/lib/session";
import { updateCenter } from "../actions";

export default async function Settings({ params, searchParams }: { params: Promise<{ centerId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { centerId } = await params;
  const sp = await searchParams;
  const s = await requireCenterManager(centerId);
  const { t, locale } = await getI18n();
  const { data: c } = await s.supabase.from("centers").select("name, slug, country_code, city, address, phone, email, description, show_on_website, status, status_reason").eq("id", centerId).single();
  const region = new Intl.DisplayNames([locale], { type: "region" });
  return (
    <>
      <PageHeader title={t.center.settings} subtitle={`${c?.slug} · ${c?.country_code ? region.of(c.country_code) : ""}`} />
      <Flash ok={sp.ok} error={sp.error} />
      <Card className="max-w-3xl">
        <form action={updateCenter}>
          <input type="hidden" name="center_id" value={centerId} />
          <fieldset disabled={!s.writable} className="grid gap-4 sm:grid-cols-2">
            <Input label={t.onboarding.centerName} name="name" required defaultValue={c?.name} className="sm:col-span-2" />
            <Input label={t.common.city} name="city" defaultValue={c?.city ?? ""} />
            <Input label={t.center.address} name="address" defaultValue={c?.address ?? ""} />
            <Input label={t.common.phone} name="phone" type="tel" pattern="\+?[0-9 ]{6,20}" defaultValue={c?.phone ?? ""} />
            <Input label={t.common.email} name="email" type="email" defaultValue={c?.email ?? ""} />
            <Textarea label={t.center.description} name="description" maxLength={1000} defaultValue={c?.description ?? ""} className="sm:col-span-2" />
            <div className="sm:col-span-2"><Checkbox name="show_on_website" defaultChecked={c?.show_on_website} label={t.center.showOnWebsite} /></div>
            <div className="sm:col-span-2"><SubmitButton>{t.common.save}</SubmitButton></div>
          </fieldset>
        </form>
      </Card>
    </>
  );
}
