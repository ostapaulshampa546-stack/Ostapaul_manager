import { AppShell } from "@/components/app/AppShell";
import { Badge, Card, Empty, Flash, Select, Stat, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { getI18n } from "@/lib/i18n";
import { requireUser } from "@/lib/session";
import { CEFR } from "@/lib/validation";
import { updateProfile } from "@/app/account/actions";

type ClassRow = { id: string; name: string; cefr_level: string; english_variant: "us" | "uk"; room: string | null; schedule_note: string | null; status: "planned" | "active" | "finished"; center: { name: string } | null };

export default async function Learn({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const s = await requireUser("/learn");
  const { t, locale } = await getI18n();
  const sp = await searchParams;
  const p = s.profile;
  // Only this account's own enrollments (an admin or manager can read more rows through RLS, so filter explicitly)
  const { data: records } = await s.supabase.from("students").select("id, student_number, cefr_level, english_variant, status, center:centers(name)").eq("user_id", s.user.id);
  const centers = (records ?? []) as unknown as { id: string; student_number: string; cefr_level: string; status: "active" | "inactive" | "graduated"; center: { name: string } | null }[];
  const { data: enrolments } = centers.length
    ? await s.supabase.from("class_students").select("class:classes(id, name, cefr_level, english_variant, room, schedule_note, status, center:centers(name))").in("student_id", centers.map((c) => c.id))
    : { data: [] };
  const myClasses = ((enrolments ?? []) as unknown as { class: ClassRow | null }[]).map((e) => e.class).filter((c): c is ClassRow => !!c)
    .sort((a, b) => a.name.localeCompare(b.name));
  const nav = [{ href: "/learn", label: t.app.studentSpace, icon: "🎒" }, { href: "/account", label: t.app.account, icon: "👤" }];

  return (
    <AppShell t={t} locale={locale} session={s} title={p.full_name} subtitle={t.app.studentSpace} nav={nav}>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold">{t.student.welcome}, {p.full_name.split(" ")[0]} 👋</h1>
        <p className="text-muted">{t.student.subtitle}</p>
      </div>
      <Flash ok={sp.ok} error={sp.error} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label={t.student.myLevel} value={p.cefr_level} hint={t.enums.cefr[p.cefr_level].split("· ")[1]} />
        <Stat label={t.student.myVariant} value={p.english_variant === "uk" ? "🇬🇧 UK" : "🇺🇸 US"} hint={t.enums.variant[p.english_variant]} tone="gold" />
        <Stat label={t.student.myClasses} value={myClasses.length} hint={`${centers.length} ${t.student.myCenters.toLowerCase()}`} tone="night" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          <Card title={t.student.myClasses}>
            {myClasses.length === 0 ? <Empty>{centers.length ? t.student.noClasses : t.student.noCenter}</Empty> : (
              <ul className="divide-y divide-line">
                {myClasses.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-sm text-muted">{c.center?.name}{c.room ? ` · ${c.room}` : ""}{c.schedule_note ? ` · ${c.schedule_note}` : ""}</p>
                    </div>
                    <div className="flex gap-1.5"><Badge tone="blue">{c.cefr_level}</Badge><Badge tone="gold">{c.english_variant.toUpperCase()}</Badge><Badge>{t.enums.classStatus[c.status]}</Badge></div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t.student.myCenters}>
            {centers.length === 0 ? <Empty>{t.student.noCenter}</Empty> : (
              <ul className="space-y-2">{centers.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-xl bg-mist px-4 py-3">
                  <span className="font-medium">{c.center?.name}</span>
                  <span className="text-sm text-muted">{c.student_number} · {t.enums.studentStatus[c.status]}</span>
                </li>
              ))}</ul>
            )}
          </Card>
          <Card title={t.student.comingTitle}>
            <ul className="grid gap-2 sm:grid-cols-2">{t.student.coming.map((x) => <li key={x} className="rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">⏳ {x}</li>)}</ul>
          </Card>
        </div>
        <Card title={t.student.profile}>
          <form action={updateProfile} className="space-y-4">
            <input type="hidden" name="from" value="/learn" />
            <input type="hidden" name="full_name" value={p.full_name} />
            <input type="hidden" name="phone" value={p.phone ?? ""} />
            <input type="hidden" name="country_code" value={p.country_code ?? ""} />
            <input type="hidden" name="locale" value={p.locale} />
            <Select label={t.student.myLevel} name="cefr_level" defaultValue={p.cefr_level} hint={t.student.levelHelp} options={CEFR.map((l) => ({ value: l, label: t.enums.cefr[l] }))} />
            <fieldset>
              <legend className="field-label">{t.student.myVariant}</legend>
              <div className="grid grid-cols-2 gap-2">
                {(["us", "uk"] as const).map((v) => (
                  <label key={v} className="cursor-pointer rounded-xl border border-line p-3 has-[:checked]:border-royal-500 has-[:checked]:bg-royal-50">
                    <input type="radio" name="english_variant" value={v} defaultChecked={p.english_variant === v} className="sr-only" />
                    <span className="text-2xl">{v === "us" ? "🇺🇸" : "🇬🇧"}</span>
                    <span className="block text-sm font-semibold">{t.enums.variant[v]}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">{t.student.variantHelp}</p>
            </fieldset>
            <Textarea label={t.student.learningGoal} name="learning_goal" defaultValue={p.learning_goal ?? ""} placeholder={t.student.learningGoalPlaceholder} maxLength={500} rows={3} />
            <SubmitButton>{t.common.save}</SubmitButton>
          </form>
          <div className="mt-6 overflow-hidden rounded-xl border border-line">
            <p className="bg-mist px-4 py-2 text-sm font-semibold">{t.student.usVsUk}</p>
            <table className="table"><tbody>{t.student.examples.map(([us, uk]) => <tr key={us}><td>🇺🇸 {us}</td><td>🇬🇧 {uk}</td></tr>)}</tbody></table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
