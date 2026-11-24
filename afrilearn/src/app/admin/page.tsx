import { Card, PageHeader, Stat } from "@/components/ui";
import { getI18n } from "@/lib/i18n";
import { requireAdmin } from "@/lib/session";

type Stats = {
  users: number; users_last_30d: number; users_by_type: Record<string, number>; centers: number; centers_by_status: Record<string, number>;
  center_students: number; center_teachers: number; classes: number; countries_active: number; leads_new: number;
  by_country: { code: string; centers: number }[]; signups_by_day: { day: string; n: number }[];
};

export default async function AdminHome() {
  const s = await requireAdmin();
  const { t, locale } = await getI18n();
  const { data } = await s.supabase.rpc("platform_stats");
  const st = data as Stats | null;
  if (!st) return <p>{t.common.errorGeneric}</p>;
  const max = Math.max(1, ...st.signups_by_day.map((d) => d.n));
  const region = new Intl.DisplayNames([locale], { type: "region" });
  return (
    <>
      <PageHeader title={t.admin.overview} subtitle="AFRILEARN" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label={t.admin.users} value={st.users} hint={`+${st.users_last_30d} · ${t.admin.newLast30}`} />
        <Stat label={t.admin.centers} value={st.centers} hint={`${st.centers_by_status.suspended ?? 0} ${t.enums.centerStatus.suspended.toLowerCase()}`} tone="gold" />
        <Stat label={t.center.students} value={st.center_students} hint={`${st.center_teachers} ${t.center.teachers.toLowerCase()} · ${st.classes} ${t.center.classes.toLowerCase()}`} tone="night" />
        <Stat label={t.admin.leads} value={st.leads_new} hint={`${st.countries_active} ${t.admin.activeCountry.toLowerCase()}`} />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title={t.admin.signups14}>
          <div className="flex h-44 items-end gap-1.5" role="img" aria-label={t.admin.signups14}>
            {st.signups_by_day.map((d) => (
              <div key={d.day} className="flex h-full flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.n}`}>
                <span className="text-[10px] font-semibold text-muted">{d.n || ""}</span>
                <div className="flex w-full flex-1 items-end"><div className="w-full rounded-t bg-gradient-to-t from-royal-600 to-royal-400" style={{ height: `${(d.n / max) * 100}%`, minHeight: 3 }} /></div>
                <span className="text-[10px] text-muted">{d.day.slice(8)}</span>
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-6">
          <Card title={t.admin.usersByType}>
            <ul className="space-y-2">
              {(["student", "center_manager", "teacher"] as const).map((k) => (
                <li key={k} className="flex justify-between"><span>{t.enums.accountType[k]}</span><span className="font-semibold">{st.users_by_type[k] ?? 0}</span></li>
              ))}
            </ul>
          </Card>
          <Card title={t.admin.centersByCountry}>
            {st.by_country.length === 0 ? <p className="text-muted">{t.common.empty}</p> : (
              <ul className="space-y-2">{st.by_country.map((c) => <li key={c.code} className="flex justify-between"><span>{region.of(c.code)}</span><span className="font-semibold">{c.centers}</span></li>)}</ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
