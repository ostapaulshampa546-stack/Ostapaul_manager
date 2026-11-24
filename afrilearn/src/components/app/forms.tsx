import { Input, Select, Textarea, Checkbox } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import type { Dict } from "@/lib/i18n";
import { CEFR } from "@/lib/validation";

type Row = Record<string, unknown> | null | undefined;
const val = (r: Row, k: string) => (r?.[k] == null ? "" : String(r[k]));

export function HiddenCtx({ centerId, id }: { centerId: string; id?: string }) {
  return <><input type="hidden" name="center_id" value={centerId} />{id && <input type="hidden" name="id" value={id} />}</>;
}

const levelOptions = (t: Dict) => CEFR.map((l) => ({ value: l, label: t.enums.cefr[l] }));
const variantOptions = (t: Dict) => (["us", "uk"] as const).map((v) => ({ value: v, label: t.enums.variant[v] }));

export function StudentFields({ t, row, disabled }: { t: Dict; row?: Row; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
      <Input label={t.common.fullName} name="full_name" required minLength={2} maxLength={120} defaultValue={val(row, "full_name")} className="sm:col-span-2" />
      <Input label={t.common.email} name="email" type="email" defaultValue={val(row, "email")} />
      <Input label={t.common.phone} name="phone" type="tel" pattern="\+?[0-9 ]{6,20}" defaultValue={val(row, "phone")} />
      <Select label={t.common.level} name="cefr_level" defaultValue={val(row, "cefr_level") || "A1"} options={levelOptions(t)} />
      <Select label={t.common.variant} name="english_variant" defaultValue={val(row, "english_variant") || "us"} options={variantOptions(t)} />
      <Input label={t.center.birthDate} name="birth_date" type="date" defaultValue={val(row, "birth_date")} />
      <Input label={t.center.enrolledOn} name="enrolled_on" type="date" defaultValue={val(row, "enrolled_on")} />
      <Input label={t.center.guardianName} name="guardian_name" maxLength={120} defaultValue={val(row, "guardian_name")} />
      <Input label={t.center.guardianPhone} name="guardian_phone" type="tel" pattern="\+?[0-9 ]{6,20}" defaultValue={val(row, "guardian_phone")} />
      {row && <Select label={t.common.status} name="status" defaultValue={val(row, "status")} options={(["active", "inactive", "graduated"] as const).map((s) => ({ value: s, label: t.enums.studentStatus[s] }))} />}
      <Textarea label={t.center.notes} name="notes" maxLength={1000} rows={2} defaultValue={val(row, "notes")} className="sm:col-span-2" />
      <div className="sm:col-span-2"><SubmitButton>{row ? t.common.save : t.common.create}</SubmitButton></div>
    </fieldset>
  );
}

export function TeacherFields({ t, row, disabled }: { t: Dict; row?: Row; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
      <Input label={t.common.fullName} name="full_name" required minLength={2} maxLength={120} defaultValue={val(row, "full_name")} className="sm:col-span-2" />
      <Input label={t.common.email} name="email" type="email" defaultValue={val(row, "email")} />
      <Input label={t.common.phone} name="phone" type="tel" pattern="\+?[0-9 ]{6,20}" defaultValue={val(row, "phone")} />
      <Input label={t.center.specialties} name="specialties" maxLength={300} defaultValue={val(row, "specialties")} placeholder="Business English, IELTS…" className={row ? "" : "sm:col-span-2"} />
      {row && <Select label={t.common.status} name="status" defaultValue={val(row, "status")} options={(["active", "inactive"] as const).map((s) => ({ value: s, label: t.enums.personStatus[s] }))} />}
      <div className="sm:col-span-2"><SubmitButton>{row ? t.common.save : t.common.create}</SubmitButton></div>
    </fieldset>
  );
}

export function ClassFields({ t, row, teachers, programs, disabled }:
  { t: Dict; row?: Row; teachers: { id: string; full_name: string }[]; programs: { id: string; name: string }[]; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Input label={t.common.name} name="name" required minLength={2} maxLength={120} defaultValue={val(row, "name")} placeholder="B1 — Morning" />
      <Select label={t.common.level} name="cefr_level" defaultValue={val(row, "cefr_level") || "A1"} options={levelOptions(t)} />
      <Select label={t.common.variant} name="english_variant" defaultValue={val(row, "english_variant") || "us"} options={variantOptions(t)} />
      <Select label={t.center.teacher} name="teacher_id" defaultValue={val(row, "teacher_id")} options={[{ value: "", label: t.center.noTeacher }, ...teachers.map((x) => ({ value: x.id, label: x.full_name }))]} />
      <Select label={t.center.program} name="program_id" defaultValue={val(row, "program_id")} options={[{ value: "", label: "—" }, ...programs.map((x) => ({ value: x.id, label: x.name }))]} />
      <Input label={t.center.capacity} name="capacity" type="number" min={1} max={500} required defaultValue={val(row, "capacity") || "25"} />
      <Input label={t.center.room} name="room" maxLength={60} defaultValue={val(row, "room")} />
      <Input label={t.center.startDate} name="start_date" type="date" defaultValue={val(row, "start_date")} />
      <Input label={t.center.endDate} name="end_date" type="date" defaultValue={val(row, "end_date")} />
      <Input label={t.center.schedule} name="schedule_note" maxLength={300} defaultValue={val(row, "schedule_note")} placeholder={t.center.schedulePlaceholder} className="sm:col-span-2" />
      <Select label={t.common.status} name="status" defaultValue={val(row, "status") || "planned"} options={(["planned", "active", "finished"] as const).map((s) => ({ value: s, label: t.enums.classStatus[s] }))} />
      <div className="sm:col-span-2 xl:col-span-3"><SubmitButton>{row ? t.common.save : t.common.create}</SubmitButton></div>
    </fieldset>
  );
}

export function ProgramFields({ t, row, disabled }: { t: Dict; row?: Row; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Input label={t.common.name} name="name" required minLength={2} maxLength={120} defaultValue={val(row, "name")} className="xl:col-span-2" />
      <Select label={t.common.level} name="cefr_level" defaultValue={val(row, "cefr_level") || "A1"} options={levelOptions(t)} />
      <Select label={t.common.variant} name="english_variant" defaultValue={val(row, "english_variant")} options={[{ value: "", label: "US + UK" }, ...variantOptions(t)]} />
      <Input label={t.center.durationWeeks} name="duration_weeks" type="number" min={1} max={260} defaultValue={val(row, "duration_weeks")} />
      <Textarea label={t.center.description} name="description" maxLength={2000} rows={2} defaultValue={val(row, "description")} className="sm:col-span-2 xl:col-span-3" />
      <div className="sm:col-span-2 xl:col-span-4"><SubmitButton>{row ? t.common.save : t.common.create}</SubmitButton></div>
    </fieldset>
  );
}

export { Checkbox };
