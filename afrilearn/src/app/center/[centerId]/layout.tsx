import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { getI18n } from "@/lib/i18n";
import { centerNav } from "@/lib/nav";
import { requireCenterManager } from "@/lib/session";

export default async function CenterLayout({ children, params }: { children: React.ReactNode; params: Promise<{ centerId: string }> }) {
  const { centerId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(centerId)) notFound();
  const s = await requireCenterManager(centerId);
  const { t, locale } = await getI18n();
  const banner = !s.writable ? <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-danger">{t.app.centerSuspended}</div> : null;
  return (
    <AppShell t={t} locale={locale} session={s} title={s.center.name} subtitle={`${t.app.centerSpace} · ${t.enums.role[s.role]}`} nav={centerNav(t, centerId)} banner={banner}>
      {children}
    </AppShell>
  );
}
