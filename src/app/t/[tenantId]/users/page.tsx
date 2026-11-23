import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ALL_PERMISSIONS, getTenantContext, ROLE_LABELS } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader, Table, sp } from "@/components/ui";
import { dateTime, date } from "@/lib/format";
import { usersLabel } from "@/lib/plans";
import { failIfError, str, withParam } from "@/lib/server-actions";

const ROLES_BY_SECTOR: Record<string, string[]> = {
  restaurant: ["admin", "manager", "accountant", "cashier", "waiter", "cook", "staff", "viewer"],
  school: ["admin", "manager", "accountant", "cashier", "secretary", "teacher", "staff", "viewer"],
  pme: ["admin", "manager", "accountant", "cashier", "secretary", "staff", "viewer"],
};

async function invite(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"); const back = `/t/${tenantId}/users`;
  const supabase = await createClient();
  const perms = fd.getAll("permissions").map(String).filter((p) => ALL_PERMISSIONS.includes(p));
  const { error } = await supabase.from("invitations").insert({ tenant_id: tenantId, email: str(fd, "email").toLowerCase(), role: str(fd, "role"), permissions: perms });
  await failIfError(supabase, tenantId, error, "insert:invitations", back);
  revalidatePath(back);
  redirect(withParam(back, "success", "Invitation créée : la personne obtient l'accès en créant son compte (ou en se connectant) avec cette adresse e-mail."));
}
async function updateMember(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"); const back = `/t/${tenantId}/users`;
  const supabase = await createClient();
  const perms = fd.getAll("permissions").map(String).filter((p) => ALL_PERMISSIONS.includes(p));
  const { error } = await supabase.from("memberships").update({ role: str(fd, "role"), is_active: fd.get("is_active") === "on", permissions: perms })
    .eq("id", str(fd, "id")).eq("tenant_id", tenantId);
  await failIfError(supabase, tenantId, error, "update:memberships", back);
  redirect(withParam(back, "success", "Utilisateur mis à jour."));
}
async function removeRow(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"); const back = `/t/${tenantId}/users`;
  const supabase = await createClient();
  const { error } = await supabase.from(str(fd, "kind") === "invitation" ? "invitations" : "memberships").delete().eq("id", str(fd, "id")).eq("tenant_id", tenantId);
  await failIfError(supabase, tenantId, error, "delete:member", back);
  redirect(withParam(back, "success", "Accès retiré."));
}

export default async function Users({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("users.manage")) return <Empty>Réservé au propriétaire et aux administrateurs.</Empty>;
  const supabase = await createClient();
  const [{ data: members }, { data: invites }, { data: plan }] = await Promise.all([
    supabase.from("memberships").select("*").eq("tenant_id", tenantId).order("created_at"),
    supabase.from("invitations").select("*").eq("tenant_id", tenantId).is("accepted_at", null),
    supabase.rpc("tenant_plan", { p_tenant: tenantId }),
  ]);
  const { data: profiles } = await supabase.from("profiles").select("id, full_name, phone").in("id", (members ?? []).map((m) => m.user_id));
  const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));
  const roles = ROLES_BY_SECTOR[ctx.tenant.sector];
  const advanced = ctx.has("permissions_advanced");
  const extra = (members ?? []).filter((m) => m.role !== "owner" && m.is_active).length + (invites ?? []).length;
  const PermBoxes = ({ selected }: { selected: string[] }) => advanced ? (
    <details className="text-xs"><summary className="cursor-pointer text-electric-600">Permissions supplémentaires</summary>
      <div className="mt-1 grid grid-cols-2 gap-1">{ALL_PERMISSIONS.map((p) => <label key={p} className="flex gap-1"><input type="checkbox" name="permissions" value={p} defaultChecked={selected.includes(p)} />{p}</label>)}</div>
    </details>
  ) : null;
  return (
    <div>
      <PageHeader title="Utilisateurs, rôles et permissions" subtitle={`${extra} utilisateur(s) supplémentaire(s) · formule : ${usersLabel((plan as { max_extra_users: number | null } | null)?.max_extra_users ?? null)}`} />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table head={["Utilisateur", "Rôle", "Actif", "Depuis", ""]}>
            {(members ?? []).map((m) => {
              const prof = profMap.get(m.user_id) as { full_name: string | null; phone: string | null } | undefined;
              return (
                <tr key={m.id}>
                  <td className="font-medium">{prof?.full_name ?? "—"}<div className="text-xs text-slate-400">{prof?.phone}</div></td>
                  {m.role === "owner" ? <><td>{ROLE_LABELS.owner}</td><td>✓</td><td>{date(m.created_at)}</td><td /></> : (
                    <td colSpan={4}>
                      <form action={updateMember} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="id" value={m.id} />
                        <select name="role" defaultValue={m.role} className="input w-auto py-1">{roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select>
                        <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="is_active" defaultChecked={m.is_active} /> actif</label>
                        <span className="text-xs text-slate-400">{date(m.created_at)}</span>
                        <button className="btn-ghost btn-sm">Enregistrer</button>
                        <PermBoxes selected={m.permissions ?? []} />
                      </form>
                      <form action={removeRow} className="mt-1"><input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="id" value={m.id} /><input type="hidden" name="kind" value="member" /><button className="text-xs text-red-600">Retirer l&apos;accès</button></form>
                    </td>
                  )}
                </tr>
              );
            })}
          </Table>
          {!!invites?.length && <>
            <h2 className="mb-2 mt-6 font-bold">Invitations en attente</h2>
            <Table head={["E-mail", "Rôle", "Créée", ""]}>
              {invites.map((i) => <tr key={i.id}><td>{i.email}</td><td>{ROLE_LABELS[i.role]}</td><td>{dateTime(i.created_at)}</td>
                <td><form action={removeRow}><input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="id" value={i.id} /><input type="hidden" name="kind" value="invitation" /><button className="btn-ghost btn-sm text-red-600">Annuler</button></form></td></tr>)}
            </Table>
          </>}
        </div>
        <form action={invite} className="card h-fit space-y-3">
          <h2 className="font-bold">Inviter un utilisateur</h2>
          <input type="hidden" name="tenant" value={tenantId} />
          <div><label className="label">E-mail</label><input name="email" type="email" required className="input" /></div>
          <div><label className="label">Rôle</label><select name="role" className="input">{roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></div>
          <PermBoxes selected={[]} />
          {!advanced && <p className="text-xs text-slate-500">Les permissions personnalisées par utilisateur sont disponibles en Premium.</p>}
          <button className="btn-primary w-full">Inviter</button>
        </form>
      </div>
    </div>
  );
}
