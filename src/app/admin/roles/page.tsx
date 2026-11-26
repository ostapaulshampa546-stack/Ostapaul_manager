import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Flash, PageHeader, sp } from "@/components/ui";
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMS, PERMISSION_LABELS, ROLE_LABELS } from "@/lib/context";
import { str, withParam } from "@/lib/server-actions";

const EDITABLE = ["manager", "accountant", "cashier", "waiter", "cook", "teacher", "secretary", "staff", "viewer"];

async function save(fd: FormData) {
  "use server";
  const role = str(fd, "role");
  if (!EDITABLE.includes(role)) redirect("/admin/roles");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const perms = fd.getAll("perm").map(String).filter((p) => ALL_PERMISSIONS.includes(p));
  const { error } = fd.get("reset") === "1"
    ? await supabase.from("platform_role_permissions").update({ permissions: DEFAULT_ROLE_PERMS[role], updated_at: new Date().toISOString(), updated_by: user?.id }).eq("role", role)
    : await supabase.from("platform_role_permissions").upsert({ role, permissions: perms, updated_at: new Date().toISOString(), updated_by: user?.id });
  redirect(withParam("/admin/roles", error ? "error" : "success", error?.message ?? `Rôle « ${ROLE_LABELS[role]} » mis à jour pour tous les établissements.`));
}

export default async function Roles({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const q = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("platform_role_permissions").select("role, permissions");
  const custom = new Map((data ?? []).map((r) => [r.role as string, r.permissions as string[]]));
  return (
    <div>
      <PageHeader title="Rôles & permissions" subtitle="Ce que chaque rôle peut faire, dans tous les établissements. Propriétaire et Administrateur ont toujours tous les droits." />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="grid gap-4 lg:grid-cols-2">
        {EDITABLE.map((role) => {
          const current = custom.get(role) ?? DEFAULT_ROLE_PERMS[role] ?? [];
          return (
            <form key={role} action={save} className="card">
              <input type="hidden" name="role" value={role} />
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold">{ROLE_LABELS[role]}</h2>
                {custom.has(role) && <span className="badge bg-gold-100 text-navy-900">Personnalisé</span>}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                {ALL_PERMISSIONS.filter((p) => !["users.manage", "settings.write"].includes(p)).map((p) => (
                  <label key={p} className="flex items-center gap-2"><input type="checkbox" name="perm" value={p} defaultChecked={current.includes(p)} />{PERMISSION_LABELS[p] ?? p}</label>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button className="btn-primary btn-sm">Enregistrer</button>
                {custom.has(role) && <button name="reset" value="1" className="btn-ghost btn-sm">Revenir aux valeurs par défaut</button>}
              </div>
            </form>
          );
        })}
      </div>
      <p className="mt-4 text-xs text-slate-500">« Gérer les utilisateurs » et « Paramètres » restent réservés au propriétaire et aux administrateurs de chaque établissement. Les permissions supplémentaires par personne (formule Premium) s&apos;ajoutent à celles du rôle.</p>
    </div>
  );
}
