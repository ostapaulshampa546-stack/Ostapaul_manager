import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, Flash, PageHeader, sp } from "@/components/ui";
import { todayISO } from "@/lib/format";
import { failIfError, str, withParam } from "@/lib/server-actions";

async function save(fd: FormData) {
  "use server";
  const tenantId = str(fd, "tenant"), klass = str(fd, "class"), day = str(fd, "date");
  const back = `/t/${tenantId}/school/rollcall?class=${klass}&date=${day}`;
  const items = Array.from(fd.entries()).filter(([k]) => k.startsWith("st_")).map(([k, v]) => ({ student_id: k.slice(3), status: String(v) }))
    .filter((i) => ["present", "absent", "late", "excused"].includes(i.status));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_roll_call", { p_class: klass, p_date: day, p_items: items });
  await failIfError(supabase, tenantId, error, "record_roll_call", back);
  redirect(withParam(back, "success", `Appel enregistré (${data} élèves).`));
}

export default async function RollCall({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("attendance.scan")) return <Empty>Accès réservé.</Empty>;
  const supabase = await createClient();
  const { data: classes } = await supabase.from("classes").select("id, name").eq("tenant_id", tenantId).order("name");
  const klass = q.class ?? classes?.[0]?.id;
  const day = q.date ?? todayISO();
  const { data: students } = await supabase.from("students").select("id, first_name, post_name, last_name").eq("class_id", klass ?? "").eq("status", "active").order("last_name");
  const { data: att } = await supabase.from("attendance").select("person_id, status").eq("tenant_id", tenantId).eq("attendance_date", day).eq("person_type", "student");
  const st = new Map((att ?? []).map((a) => [a.person_id, a.status]));
  return (
    <div>
      <PageHeader title="Appel en classe" subtitle="Alternative au scan QR. Les élèves déjà pointés par QR apparaissent présents." />
      <Flash error={sp(q.error)} success={sp(q.success)} />
      <form className="no-print card mb-4 flex flex-wrap items-end gap-3">
        <div><label className="label">Classe</label><select name="class" defaultValue={klass} className="input">{(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className="label">Date</label><input type="date" name="date" defaultValue={day} className="input" /></div>
        <button className="btn-ghost">Afficher</button>
      </form>
      {!students?.length ? <Empty>Aucun élève.</Empty> : (
        <form action={save} className="card">
          <input type="hidden" name="tenant" value={tenantId} /><input type="hidden" name="class" value={klass} /><input type="hidden" name="date" value={day} />
          <ul className="divide-y divide-slate-100">
            {students.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-medium">{s.last_name} {s.post_name ?? ""} {s.first_name}</span>
                <span className="flex gap-1 text-xs">
                  {[["present", "Présent"], ["late", "Retard"], ["absent", "Absent"], ["excused", "Excusé"]].map(([v, l]) => (
                    <label key={v} className="cursor-pointer rounded-md border px-2 py-1 has-[:checked]:border-navy-900 has-[:checked]:bg-navy-900 has-[:checked]:text-white">
                      <input type="radio" name={`st_${s.id}`} value={v} defaultChecked={(st.get(s.id) ?? "present") === v} className="sr-only" />{l}
                    </label>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          {ctx.active && <button className="btn-primary mt-4">Enregistrer l&apos;appel</button>}
        </form>
      )}
    </div>
  );
}
