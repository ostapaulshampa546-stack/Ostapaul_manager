import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/context";
import { SECTORS } from "@/lib/plans";
import { ROLE_LABELS } from "@/lib/context";

export const metadata = { title: "Mes établissements" };

export default async function AppHome() {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.rpc("accept_invitations");
  const [{ data: memberships }, { data: admin }] = await Promise.all([
    supabase.from("memberships").select("role, tenants(id, name, sector, city, parent_id, status)").eq("user_id", user.id).eq("is_active", true),
    supabase.from("platform_admins").select("user_id").eq("user_id", user.id).maybeSingle(),
  ]);
  const list = (memberships ?? []).map((m) => ({ role: m.role as string, t: m.tenants as unknown as { id: string; name: string; sector: string; city: string; parent_id: string | null; status: string } }));
  if (!admin && list.length === 1) redirect(`/t/${list[0].t.id}`);
  if (!admin && list.length === 0) redirect("/onboarding");
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between">
        <Logo href="/app" />
        <form action="/auth/signout" method="post"><button className="btn-ghost">Déconnexion</button></form>
      </div>
      <h1 className="mt-8 text-2xl font-bold">Mes établissements</h1>
      {admin && <Link href="/admin" className="card mt-4 flex items-center justify-between border-gold-400 bg-navy-900 text-white"><span className="font-bold">👑 Espace Super Admin</span><span>→</span></Link>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {list.map(({ t, role }) => {
          const s = SECTORS.find((x) => x.key === t.sector);
          return (
            <Link key={t.id} href={`/t/${t.id}`} className="card border-l-4 hover:shadow-md" style={{ borderLeftColor: s?.accent }}>
              <div className="text-sm text-slate-500">{s?.icon} {s?.label}{t.parent_id ? " · succursale" : ""}</div>
              <div className="mt-1 text-lg font-bold">{t.name}</div>
              <div className="text-xs text-slate-500">{t.city} · {ROLE_LABELS[role] ?? role}{t.status === "suspended" ? " · SUSPENDU" : ""}</div>
            </Link>
          );
        })}
      </div>
      <Link href="/onboarding" className="btn-primary mt-6">+ Créer un établissement</Link>
    </main>
  );
}
