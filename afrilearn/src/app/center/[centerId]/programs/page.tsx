import { Badge, Card, Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { HiddenCtx, ProgramFields } from "@/components/app/forms";
import { getI18n } from "@/lib/i18n";
import { requireCenterManager } from "@/lib/session";
import { deleteProgram, saveProgram } from "../actions";

export default async function Programs({ params, searchParams }: { params: Promise<{ centerId: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { centerId } = await params;
  const sp = await searchParams;
  const s = await requireCenterManager(centerId);
  const { t } = await getI18n();
  const { data: rows } = await s.supabase.from("programs").select("id, name, description, cefr_level, english_variant, duration_weeks").eq("center_id", centerId).order("cefr_level").order("name");
  return (
    <>
      <PageHeader title={t.center.programs} subtitle={s.center.name} actions={<a href="#new" className="btn btn-primary">+ {t.center.newProgram}</a>} />
      <Flash ok={sp.ok} error={sp.error} />
      {!rows?.length ? <Empty>{t.common.empty}</Empty> : (
        <div className="space-y-3">
          {rows.map((p) => (
            <details key={p.id} className="card group p-5">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="font-display font-semibold">{p.name}</span>
                  {p.description && <span className="block text-sm text-muted">{p.description}</span>}
                </span>
                <span className="flex gap-1.5">
                  <Badge tone="blue">{p.cefr_level}</Badge>
                  <Badge tone="gold">{p.english_variant ? p.english_variant.toUpperCase() : "US+UK"}</Badge>
                  {p.duration_weeks && <Badge>{p.duration_weeks} sem.</Badge>}
                  <span className="text-sm font-semibold text-royal-600">{t.common.edit}</span>
                </span>
              </summary>
              <div className="mt-5 border-t border-line pt-5">
                <form action={saveProgram}><HiddenCtx centerId={centerId} id={p.id} /><ProgramFields t={t} row={p} disabled={!s.writable} /></form>
                {s.writable && (
                  <form action={deleteProgram} className="mt-3">
                    <HiddenCtx centerId={centerId} id={p.id} />
                    <SubmitButton variant="danger" size="sm" confirm={t.common.confirmDelete}>{t.common.delete}</SubmitButton>
                  </form>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
      <div id="new" className="scroll-mt-20">
        <Card title={t.center.newProgram} className="mt-8">
          <form action={saveProgram}><HiddenCtx centerId={centerId} /><ProgramFields t={t} disabled={!s.writable} /></form>
        </Card>
      </div>
    </>
  );
}
