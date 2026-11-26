import Link from "next/link";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { getPlatformInfo } from "@/lib/site";

const LINKS = [
  ["/restaurant", "Restaurant"], ["/ecole", "École"], ["/pme", "PME"], ["/pricing", "Tarifs"], ["/faq", "FAQ"], ["/contact", "Contact"],
];

export async function SiteHeader({ dark = true }: { dark?: boolean }) {
  const supabase = await createClient();
  const [{ data }, info] = await Promise.all([supabase.auth.getUser(), getPlatformInfo()]);
  const link = dark ? "text-white/80 hover:text-white" : "text-navy-900/80 hover:text-navy-900";
  return (
    <>
    {info.announcement && (
      <div className="bg-gold-500 px-4 py-2 text-center text-sm font-semibold text-navy-950">{info.announcement}</div>
    )}
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:py-5">
      <Logo dark={dark} />
      <nav className="hidden items-center gap-1 text-sm lg:flex">
        {LINKS.map(([h, l]) => <Link key={h} href={h} className={`rounded-lg px-3 py-2 ${link}`}>{l}</Link>)}
      </nav>
      <div className="flex items-center gap-1">
        <Link href={data.user ? "/app" : "/login"} className={`hidden rounded-lg px-3 py-2 text-sm sm:inline ${link}`}>{data.user ? "Mon espace" : "Connexion"}</Link>
        {!data.user && <Link href="/signup" className="btn-gold whitespace-nowrap px-3 py-1.5 sm:py-2">Essai gratuit</Link>}
        <details className="relative lg:hidden">
          <summary className={`list-none rounded-lg px-2 py-1 text-xl ${link}`} aria-label="Menu">☰</summary>
          <div className="absolute right-0 z-30 mt-2 w-48 rounded-xl bg-white p-2 shadow-xl">
            {LINKS.map(([h, l]) => <Link key={h} href={h} className="block rounded-lg px-3 py-2 text-sm text-navy-900 hover:bg-slate-100">{l}</Link>)}
            <Link href={data.user ? "/app" : "/login"} className="block rounded-lg px-3 py-2 text-sm font-semibold text-electric-600 hover:bg-slate-100 sm:hidden">{data.user ? "Mon espace" : "Connexion"}</Link>
          </div>
        </details>
      </div>
    </header>
    </>
  );
}
