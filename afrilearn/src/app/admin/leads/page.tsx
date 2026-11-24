import { Badge, Empty, Flash, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { getI18n } from "@/lib/i18n";
import { requireAdmin } from "@/lib/session";
import { setLeadStatus } from "../actions";

export default async function Leads({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const s = await requireAdmin();
  const sp = await searchParams;
  const { t, locale } = await getI18n();
  const { data: rows } = await s.supabase.from("leads").select("id, kind, full_name, email, phone, organization, country_code, message, status, created_at").order("created_at", { ascending: false }).limit(200);
  const date = new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { dateStyle: "medium", timeStyle: "short" });
  const tone = { new: "gold", in_progress: "blue", closed: "gray" } as const;
  return (
    <>
      <PageHeader title={t.admin.leads} subtitle={`${rows?.length ?? 0}`} />
      <Flash ok={sp.ok} error={sp.error} />
      {!rows?.length ? <Empty>{t.common.empty}</Empty> : (
        <div className="space-y-3">
          {rows.map((l) => (
            <article key={l.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{l.full_name} <span className="font-normal text-muted">· <a href={`mailto:${l.email}`} className="text-royal-600">{l.email}</a>{l.phone ? ` · ${l.phone}` : ""}</span></p>
                  <p className="text-xs text-muted">{date.format(new Date(l.created_at))}{l.organization ? ` · ${l.organization}` : ""}{l.country_code ? ` · ${l.country_code}` : ""}</p>
                </div>
                <span className="flex gap-1.5"><Badge tone="blue">{t.enums.leadKind[l.kind as "contact"]}</Badge><Badge tone={tone[l.status as "new"]}>{t.enums.leadStatus[l.status as "new"]}</Badge></span>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm">{l.message}</p>
              {l.status !== "closed" && (
                <div className="mt-3 flex gap-2">
                  {(l.status === "new" ? (["in_progress", "closed"] as const) : (["closed"] as const)).map((st) => (
                    <form key={st} action={setLeadStatus}>
                      <input type="hidden" name="id" value={l.id} /><input type="hidden" name="status" value={st} />
                      <SubmitButton size="sm" variant="ghost">{st === "closed" ? t.admin.markClosed : t.admin.markInProgress}</SubmitButton>
                    </form>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
