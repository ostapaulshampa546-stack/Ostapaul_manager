import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getI18n } from "@/lib/i18n";
import { getSession } from "@/lib/session";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { t, locale } = await getI18n();
  const session = await getSession().catch(() => null);
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">{t.common.skipToContent}</a>
      <SiteHeader t={t} locale={locale} loggedIn={Boolean(session)} />
      <main id="main">{children}</main>
      <SiteFooter t={t} />
    </>
  );
}
