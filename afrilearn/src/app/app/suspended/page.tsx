import { Logo } from "@/components/Logo";
import { getI18n } from "@/lib/i18n";
import { logout } from "@/app/(auth)/actions";

export default async function Suspended() {
  const { t } = await getI18n();
  return (
    <main id="main" className="flex min-h-screen items-center justify-center p-4">
      <div className="card max-w-md p-8 text-center">
        <Logo />
        <h1 className="font-display mt-6 text-2xl font-bold">{t.app.suspendedTitle}</h1>
        <p className="mt-2 text-muted">{t.app.suspendedText}</p>
        <form action={logout} className="mt-6"><button className="btn btn-primary">{t.common.logout}</button></form>
      </div>
    </main>
  );
}
