import Link from "next/link";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader, Stat, StatusBadge, Table } from "@/components/ui";
import { time, todayISO } from "@/lib/format";

const TYPE_LABEL: Record<string, string> = { employee: "Personnel", student: "Élève", teacher: "Enseignant" };

export default async function Attendance({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<{ date?: string; type?: string }> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("attendance.read")) return <Empty>Accès réservé.</Empty>;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(q.date ?? "") ? q.date! : todayISO();
  const supabase = await createClient();
  let aq = supabase.from("attendance").select("*").eq("tenant_id", tenantId).eq("attendance_date", day).order("scanned_at", { ascending: false }).limit(2000);
  if (q.type) aq = aq.eq("person_type", q.type);
  const { data: rows } = await aq;
  const ids = (t: string) => Array.from(new Set((rows ?? []).filter((r) => r.person_type === t).map((r) => r.person_id)));
  const [emp, stu, tea] = await Promise.all([
    ids("employee").length ? supabase.from("employees").select("id, first_name, last_name, position").in("id", ids("employee")) : Promise.resolve({ data: [] }),
    ids("student").length ? supabase.from("students").select("id, first_name, post_name, last_name, classes(name)").in("id", ids("student")) : Promise.resolve({ data: [] }),
    ids("teacher").length ? supabase.from("teachers").select("id, first_name, last_name, specialty").in("id", ids("teacher")) : Promise.resolve({ data: [] }),
  ]);
  const names = new Map<string, [string, string]>();
  (emp.data ?? []).forEach((p: { id: string; first_name: string; last_name: string; position: string | null }) => names.set(p.id, [`${p.first_name} ${p.last_name}`, p.position ?? ""]));
  (stu.data ?? []).forEach((p: { id: string; first_name: string; post_name: string | null; last_name: string; classes: unknown }) =>
    names.set(p.id, [`${p.last_name} ${p.post_name ?? ""} ${p.first_name}`, (p.classes as { name?: string } | null)?.name ?? ""]));
  (tea.data ?? []).forEach((p: { id: string; first_name: string; last_name: string; specialty: string | null }) => names.set(p.id, [`${p.first_name} ${p.last_name}`, p.specialty ?? ""]));
  const present = new Set((rows ?? []).filter((r) => r.status !== "absent").map((r) => r.person_id)).size;
  const late = new Set((rows ?? []).filter((r) => r.status === "late").map((r) => r.person_id)).size;

  return (
    <div>
      <PageHeader title="Présences" subtitle="Pointages QR (en ligne et synchronisés) et appels manuels."
        actions={<>
          <Link href={`/t/${tenantId}/scanner`} className="btn-dark">📷 Scanner</Link>
          {ctx.has("export") && <a className="btn-ghost" href={`/api/export/attendance?tenant=${tenantId}&date=${day}`}>⬇️ Excel (CSV)</a>}
        </>} />
      <form className="no-print mb-4 flex flex-wrap gap-2">
        <input type="date" name="date" defaultValue={day} className="input w-auto" />
        <select name="type" defaultValue={q.type ?? ""} className="input w-auto">
          <option value="">Tous</option><option value="employee">Personnel</option>
          {ctx.tenant.sector === "school" && <><option value="student">Élèves</option><option value="teacher">Enseignants</option></>}
        </select>
        <button className="btn-ghost">Afficher</button>
      </form>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Personnes présentes" value={present} />
        <Stat label="En retard" value={late} tone={late ? "bad" : "default"} />
        <Stat label="Pointages" value={(rows ?? []).length} />
      </div>
      {rows?.length ? (
        <Table head={["Heure", "Personne", "Type", "Détail", "Mouvement", "Statut", "Source"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{time(r.scanned_at)}</td>
              <td className="font-medium">{names.get(r.person_id)?.[0] ?? "—"}</td>
              <td>{TYPE_LABEL[r.person_type]}</td>
              <td className="text-slate-500">{names.get(r.person_id)?.[1]}</td>
              <td>{r.event_type === "in" ? "Entrée" : "Sortie"}</td>
              <td>{r.status === "late" ? <span className="badge bg-orange-100 text-orange-700">Retard</span> : <StatusBadge status={r.status === "present" ? "active" : r.status} />}</td>
              <td className="text-xs text-slate-500">{r.source === "qr" ? "QR" : "Appel"}{r.synced_at && new Date(r.synced_at).getTime() - new Date(r.scanned_at).getTime() > 120000 ? " · synchronisé" : ""}</td>
            </tr>
          ))}
        </Table>
      ) : <Empty>Aucun pointage ce jour.</Empty>}
    </div>
  );
}
