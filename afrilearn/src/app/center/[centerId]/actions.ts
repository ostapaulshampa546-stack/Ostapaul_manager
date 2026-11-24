"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireCenterManager } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { back } from "@/lib/flash";
import { dbErrorMessage } from "@/lib/errors";
import { formObject, v } from "@/lib/validation";

/** Every action re-checks the caller's role server-side; RLS enforces it again in the database. */
async function ctx(fd: FormData) {
  const centerId = v.uuid.parse(String(fd.get("center_id") ?? ""));
  const s = await requireCenterManager(centerId);
  const { t } = await getI18n();
  const base = `/center/${centerId}`;
  return { s, t, centerId, base, db: s.supabase };
}

const id = (fd: FormData, key = "id") => {
  const r = v.uuid.safeParse(String(fd.get(key) ?? ""));
  return r.success ? r.data : null;
};

// ---------------------------------------------------------------- students
const studentSchema = z.object({
  full_name: v.name, email: v.optEmail, phone: v.optPhone, birth_date: v.optDate,
  guardian_name: v.optText(120), guardian_phone: v.optPhone, cefr_level: v.cefr, english_variant: v.variant,
  status: z.enum(["active", "inactive", "graduated"]).default("active"), enrolled_on: v.optDate, notes: v.optText(1000),
});

export async function saveStudent(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const sid = id(fd);
  const from = sid ? `${base}/students/${sid}` : `${base}/students`;
  const p = studentSchema.safeParse(formObject(fd));
  if (!p.success) back(from, { error: t.common.errorGeneric });
  const row = { ...p.data, enrolled_on: p.data.enrolled_on ?? undefined };
  if (sid) {
    const { error } = await db.from("students").update(row).eq("id", sid).eq("center_id", centerId);
    if (error) back(from, { error: dbErrorMessage(t, error) });
    back(from, { ok: t.common.saved });
  }
  const { data, error } = await db.from("students").insert({ ...row, center_id: centerId }).select("id").single();
  if (error) back(from, { error: dbErrorMessage(t, error) });
  back(`${base}/students/${data.id}`, { ok: t.common.created });
}

export async function deleteStudent(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const { error } = await db.from("students").delete().eq("id", id(fd) ?? "").eq("center_id", centerId);
  if (error) back(`${base}/students`, { error: dbErrorMessage(t, error) });
  back(`${base}/students`, { ok: t.common.deleted });
}

// ---------------------------------------------------------------- teachers
const teacherSchema = z.object({
  full_name: v.name, email: v.optEmail, phone: v.optPhone, specialties: v.optText(300),
  status: z.enum(["active", "inactive"]).default("active"),
});

export async function saveTeacher(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const tid = id(fd);
  const from = tid ? `${base}/teachers/${tid}` : `${base}/teachers`;
  const p = teacherSchema.safeParse(formObject(fd));
  if (!p.success) back(from, { error: t.common.errorGeneric });
  if (tid) {
    const { error } = await db.from("teachers").update(p.data).eq("id", tid).eq("center_id", centerId);
    if (error) back(from, { error: dbErrorMessage(t, error) });
    back(from, { ok: t.common.saved });
  }
  const { data, error } = await db.from("teachers").insert({ ...p.data, center_id: centerId }).select("id").single();
  if (error) back(from, { error: dbErrorMessage(t, error) });
  back(`${base}/teachers/${data.id}`, { ok: t.common.created });
}

export async function deleteTeacher(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const { error } = await db.from("teachers").delete().eq("id", id(fd) ?? "").eq("center_id", centerId);
  if (error) back(`${base}/teachers`, { error: dbErrorMessage(t, error) });
  back(`${base}/teachers`, { ok: t.common.deleted });
}

// ---------------------------------------------------------------- invitations & accounts
export async function invitePerson(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const role = z.enum(["teacher", "student"]).parse(String(fd.get("role")));
  const pid = id(fd);
  const from = `${base}/${role}s/${pid}`;
  const { data, error } = await db.rpc("create_invitation", { p_center: centerId, p_role: role, p_person: pid });
  if (error) back(from, { error: dbErrorMessage(t, error) });
  redirect(`${from}?invite=${data}`);
}

export async function unlinkPerson(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const role = z.enum(["teacher", "student"]).parse(String(fd.get("role")));
  const pid = id(fd);
  const { error } = await db.rpc("unlink_person", { p_center: centerId, p_role: role, p_person: pid });
  back(`${base}/${role}s/${pid}`, error ? { error: dbErrorMessage(t, error) } : { ok: t.common.saved });
}

export async function inviteManager(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const email = v.email.safeParse(String(fd.get("email") ?? ""));
  if (!email.success) back(`${base}/team`, { error: t.auth.errors.email });
  const { data, error } = await db.rpc("create_invitation", { p_center: centerId, p_role: "manager", p_person: null, p_email: email.data });
  if (error) back(`${base}/team`, { error: error.code === "42501" ? t.center.onlyOwner : dbErrorMessage(t, error) });
  redirect(`${base}/team?invite=${data}`);
}

export async function revokeInvitation(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const { error } = await db.from("invitations").delete().eq("id", id(fd) ?? "").eq("center_id", centerId);
  back(`${base}/team`, error ? { error: dbErrorMessage(t, error) } : { ok: t.common.deleted });
}

export async function removeMember(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const userId = id(fd, "user_id");
  const role = z.enum(["manager", "teacher", "student"]).parse(String(fd.get("role")));
  const { error, count } = await db.from("memberships").delete({ count: "exact" }).eq("center_id", centerId).eq("user_id", userId ?? "").eq("role", role);
  if (error || !count) back(`${base}/team`, { error: error ? dbErrorMessage(t, error) : t.common.notAllowed });
  // the person's record (teacher/student) is detached from the removed account
  if (role === "teacher") await db.from("teachers").select("id").eq("center_id", centerId).eq("user_id", userId ?? "").then(async ({ data }) => {
    for (const r of data ?? []) await db.rpc("unlink_person", { p_center: centerId, p_role: "teacher", p_person: r.id });
  });
  if (role === "student") await db.from("students").select("id").eq("center_id", centerId).eq("user_id", userId ?? "").then(async ({ data }) => {
    for (const r of data ?? []) await db.rpc("unlink_person", { p_center: centerId, p_role: "student", p_person: r.id });
  });
  back(`${base}/team`, { ok: t.common.deleted });
}

// ---------------------------------------------------------------- programs
const programSchema = z.object({
  name: v.name, description: v.optText(2000), cefr_level: v.cefr,
  english_variant: z.enum(["", "us", "uk"]).transform((x) => (x === "" ? null : x)), duration_weeks: v.optInt(1, 260),
});

export async function saveProgram(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const pid = id(fd);
  const p = programSchema.safeParse(formObject(fd));
  if (!p.success) back(`${base}/programs`, { error: t.common.errorGeneric });
  const { error } = pid
    ? await db.from("programs").update(p.data).eq("id", pid).eq("center_id", centerId)
    : await db.from("programs").insert({ ...p.data, center_id: centerId });
  back(`${base}/programs`, error ? { error: dbErrorMessage(t, error) } : { ok: pid ? t.common.saved : t.common.created });
}

export async function deleteProgram(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const { error } = await db.from("programs").delete().eq("id", id(fd) ?? "").eq("center_id", centerId);
  back(`${base}/programs`, error ? { error: dbErrorMessage(t, error) } : { ok: t.common.deleted });
}

// ---------------------------------------------------------------- classes
const classSchema = z.object({
  name: v.name, cefr_level: v.cefr, english_variant: v.variant, teacher_id: v.optUuid, program_id: v.optUuid,
  room: v.optText(60), capacity: z.coerce.number().int().min(1).max(500), start_date: v.optDate, end_date: v.optDate,
  schedule_note: v.optText(300), status: z.enum(["planned", "active", "finished"]).default("planned"),
});

export async function saveClass(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const cid = id(fd);
  const from = cid ? `${base}/classes/${cid}` : `${base}/classes`;
  const p = classSchema.safeParse(formObject(fd));
  if (!p.success) back(from, { error: t.common.errorGeneric });
  if (p.data.start_date && p.data.end_date && p.data.end_date < p.data.start_date) back(from, { error: t.common.errorGeneric });
  if (cid) {
    const { error } = await db.from("classes").update(p.data).eq("id", cid).eq("center_id", centerId);
    back(from, error ? { error: dbErrorMessage(t, error) } : { ok: t.common.saved });
  }
  const { data, error } = await db.from("classes").insert({ ...p.data, center_id: centerId }).select("id").single();
  if (error) back(from, { error: dbErrorMessage(t, error) });
  back(`${base}/classes/${data.id}`, { ok: t.common.created });
}

export async function deleteClass(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const { error } = await db.from("classes").delete().eq("id", id(fd) ?? "").eq("center_id", centerId);
  back(`${base}/classes`, error ? { error: dbErrorMessage(t, error) } : { ok: t.common.deleted });
}

export async function enrollStudent(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const cid = id(fd, "class_id");
  const sid = id(fd, "student_id");
  const from = `${base}/classes/${cid}`;
  if (!cid || !sid) back(from, { error: t.common.errorGeneric });
  const { error } = await db.from("class_students").insert({ center_id: centerId, class_id: cid, student_id: sid });
  back(from, error ? { error: dbErrorMessage(t, error) } : { ok: t.common.saved });
}

export async function unenrollStudent(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const cid = id(fd, "class_id");
  const { error } = await db.from("class_students").delete().eq("center_id", centerId).eq("class_id", cid ?? "").eq("student_id", id(fd, "student_id") ?? "");
  back(`${base}/classes/${cid}`, error ? { error: dbErrorMessage(t, error) } : { ok: t.common.saved });
}

// ---------------------------------------------------------------- settings
const settingsSchema = z.object({
  name: v.name, city: v.optText(80), address: v.optText(200), phone: v.optPhone, email: v.optEmail,
  description: v.optText(1000), show_on_website: v.checkbox,
});

export async function updateCenter(fd: FormData) {
  const { t, centerId, base, db } = await ctx(fd);
  const p = settingsSchema.safeParse(formObject(fd));
  if (!p.success) back(`${base}/settings`, { error: t.common.errorGeneric });
  const { error } = await db.from("centers").update(p.data).eq("id", centerId);
  back(`${base}/settings`, error ? { error: dbErrorMessage(t, error) } : { ok: t.common.saved });
}
