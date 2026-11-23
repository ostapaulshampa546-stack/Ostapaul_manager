import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/context";
import { Logo } from "@/components/Logo";

const NAV = [
  ["/admin", "📊 Vue globale"], ["/admin/tenants", "🏢 Établissements"], ["/admin/plans", "⭐ Formules & tarifs"],
  ["/admin/transactions", "💳 Transactions"], ["/admin/tickets", "🛟 Assistance"], ["/admin/promo", "🎨 Design du jour"],
  ["/admin/card", "🪪 Ma carte"], ["/admin/settings", "⚙️ Paramètres"],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePlatformAdmin();
  return (
    <div className="min-h-screen md:flex">
      <aside className="no-print bg-navy-950 p-4 md:min-h-screen md:w-60">
        <Logo dark href="/admin" />
        <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gold-400">Super Admin</div>
        <nav className="mt-6 flex gap-1 overflow-x-auto md:flex-col">
          {NAV.map(([h, l]) => <Link key={h} href={h} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-white/80 hover:bg-white/10">{l}</Link>)}
          <Link href="/app" className="mt-4 rounded-lg px-3 py-2 text-sm text-white/50 hover:bg-white/10">← Mes établissements</Link>
        </nav>
      </aside>
      <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
