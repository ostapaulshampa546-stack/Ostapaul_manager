import Link from "next/link";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader, sp } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { cardUrl, qrSvg } from "@/lib/qr";
import { date } from "@/lib/format";
import { SECTORS } from "@/lib/plans";
import { PHOTO_TABLES, signPhotos } from "@/lib/photos";
import { PhotoButton } from "./PhotoButton";

type Person = { id: string; matricule: string | null; first_name: string; last_name: string; post_name?: string | null; phone?: string | null;
  position?: string | null; department?: string | null; specialty?: string | null; class_name?: string | null; gender?: string | null;
  birth_date?: string | null; guardian_phone?: string | null; email?: string | null; photo_path?: string | null };

const TYPES = {
  employee: { table: "employees", label: "Personnel", select: "id, matricule, first_name, last_name, phone, position, department, gender, birth_date, email, photo_path" },
  student: { table: "students", label: "Élèves / étudiants", select: "id, matricule, first_name, last_name, post_name, gender, birth_date, guardian_phone, photo_path, classes(name)" },
  teacher: { table: "teachers", label: "Enseignants", select: "id, matricule, first_name, last_name, phone, specialty, gender, email, photo_path" },
} as const;

export default async function Cards({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { tenantId } = await params;
  const q = await searchParams;
  const ctx = await getTenantContext(tenantId);
  const allowed = ctx.tenant.sector === "school" ? (["student", "teacher", "employee"] as const) : (["employee"] as const);
  const type = (allowed as readonly string[]).includes(q.type ?? "") ? (q.type as keyof typeof TYPES) : allowed[0];
  const cfg = TYPES[type];
  const supabase = await createClient();
  let pq = supabase.from(cfg.table).select(cfg.select).eq("tenant_id", tenantId).order("last_name").limit(300);
  if (q.id) pq = pq.eq("id", q.id);
  if (q.class && type === "student") pq = pq.eq("class_id", q.class);
  const [{ data: people }, { data: cards }, { data: classes }] = await Promise.all([
    pq,
    supabase.from("id_cards").select("person_id, qr_token, expires_at, revoked").eq("tenant_id", tenantId).eq("person_type", type),
    type === "student" ? supabase.from("classes").select("id, name").eq("tenant_id", tenantId).order("name") : Promise.resolve({ data: [] }),
  ]);
  const cardMap = new Map((cards ?? []).map((c) => [c.person_id, c]));
  const sector = SECTORS.find((s) => s.key === ctx.tenant.sector)!;
  const list = ((people ?? []) as unknown as (Person & { classes?: { name: string } | null })[]);
  const photos = await signPhotos(supabase, list.map((p) => p.photo_path));
  const canEdit = ctx.can(PHOTO_TABLES[type].perm);
  const rendered = await Promise.all(list.map(async (p) => {
    const c = cardMap.get(p.id);
    return { p, c, photo: p.photo_path ? photos.get(p.photo_path) : undefined, svg: c && !c.revoked ? await qrSvg(cardUrl(c.qr_token)) : null };
  }));

  return (
    <div>
      <PageHeader title="Cartes avec QR code" subtitle="Générées automatiquement pour chaque personne inscrite. Le QR sert au pointage et à la vérification."
        actions={<PrintButton label="Imprimer les cartes" />} />
      <div className="no-print mb-4 flex flex-wrap gap-2">
        {allowed.map((t) => <Link key={t} href={`?type=${t}`} className={t === type ? "btn-dark btn-sm" : "btn-ghost btn-sm"}>{TYPES[t].label}</Link>)}
        {type === "student" && (
          <form className="flex gap-2">
            <input type="hidden" name="type" value="student" />
            <select name="class" defaultValue={q.class ?? ""} className="input py-1 text-xs">
              <option value="">Toutes les classes</option>
              {(classes ?? []).map((c: { id: string; name: string }) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button className="btn-ghost btn-sm">Filtrer</button>
          </form>
        )}
      </div>
      {!rendered.length ? <Empty>Aucune personne enregistrée.</Empty> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-2">
          {rendered.map(({ p, c, svg, photo }) => (
            <div key={p.id} style={{ breakInside: "avoid" }}>
            <article className="print-area relative flex h-[204px] w-full max-w-[340px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" style={{ breakInside: "avoid" }}>
              <div className="flex w-[118px] shrink-0 flex-col items-center justify-between bg-navy-900 p-2 text-white">
                <div className="text-center text-[9px] font-bold leading-tight tracking-wide">OSTAPAUL<br /><span className="text-gold-400">MANAGER</span></div>
                <div className="rounded bg-white p-1" dangerouslySetInnerHTML={{ __html: svg ?? "" }} style={{ width: 96, height: 96 }} />
                <div className="text-[8px] text-white/60">Scannez pour pointer</div>
              </div>
              <div className="flex min-w-0 flex-1 flex-col p-3">
                <div className="truncate text-[10px] font-bold uppercase tracking-wide" style={{ color: sector.accent }}>{ctx.tenant.name}</div>
                <div className="mt-1 h-0.5 w-8 rounded bg-gold-500" />
                <div className="mt-2 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-base font-extrabold leading-tight text-navy-900">{p.last_name} {p.post_name ?? ""}</div>
                    <div className="text-sm text-navy-900">{p.first_name}</div>
                  </div>
                  {photo
                    ? <img src={photo} alt={`Photo de ${p.first_name} ${p.last_name}`} className="h-[64px] w-[48px] shrink-0 rounded border border-slate-200 object-cover" />
                    : <div className="flex h-[64px] w-[48px] shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-base font-bold text-slate-400" aria-label="Pas de photo">
                        {(p.first_name[0] ?? "") + (p.last_name[0] ?? "")}
                      </div>}
                </div>
                <dl className="mt-1 space-y-0.5 text-[10px] text-slate-600">
                  <div><dt className="inline font-semibold">Matricule : </dt><dd className="inline">{p.matricule}</dd></div>
                  {type === "student" && <div><dt className="inline font-semibold">Classe : </dt><dd className="inline">{p.classes?.name ?? "—"}</dd></div>}
                  {type === "employee" && <div><dt className="inline font-semibold">Fonction : </dt><dd className="inline">{p.position ?? "—"}{p.department ? ` · ${p.department}` : ""}</dd></div>}
                  {type === "teacher" && <div><dt className="inline font-semibold">Spécialité : </dt><dd className="inline">{p.specialty ?? "Enseignant"}</dd></div>}
                  {p.birth_date && <div><dt className="inline font-semibold">Né(e) le : </dt><dd className="inline">{date(p.birth_date)}</dd></div>}
                  {(p.phone || p.guardian_phone) && <div><dt className="inline font-semibold">{type === "student" ? "Parent" : "Tél."} : </dt><dd className="inline">{p.phone ?? p.guardian_phone}</dd></div>}
                  <div><dt className="inline font-semibold">Valide jusqu&apos;au : </dt><dd className="inline">{date(c?.expires_at)}</dd></div>
                </dl>
                {c?.revoked && <div className="mt-auto text-xs font-bold text-red-600">CARTE RÉVOQUÉE</div>}
              </div>
            </article>
            {canEdit && <PhotoButton tenantId={tenantId} type={type} personId={p.id} hasPhoto={!!p.photo_path} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
