import Link from "next/link";
import { Logo } from "@/components/Logo";
import { AfricaPoster } from "@/components/three/Hero3D";
import { LocaleSwitch } from "@/components/site/LocaleSwitch";
import { getI18n } from "@/lib/i18n";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t, locale } = await getI18n();
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="bg-night-grid relative hidden overflow-hidden p-10 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" aria-label="AFRILEARN"><Logo dark /></Link>
        <AfricaPoster className="mx-auto h-[55vh] opacity-90" />
        <div>
          <p className="font-display text-2xl font-semibold">{t.common.tagline}</p>
          <p className="mt-2 text-white/60">American English · British English · CEFR A1–C2</p>
        </div>
      </aside>
      <main id="main" className="flex flex-col px-4 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="lg:invisible" aria-label="AFRILEARN"><Logo /></Link>
          <LocaleSwitch locale={locale} />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
