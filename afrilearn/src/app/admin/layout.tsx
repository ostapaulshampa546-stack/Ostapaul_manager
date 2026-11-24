import { AppShell } from "@/components/app/AppShell";
import { getI18n } from "@/lib/i18n";
import { adminNav } from "@/lib/nav";
import { requireAdmin } from "@/lib/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireAdmin();
  const { t, locale } = await getI18n();
  return <AppShell t={t} locale={locale} session={s} title="Super Admin" subtitle={t.app.adminSpace} nav={adminNav(t)}>{children}</AppShell>;
}
