import { z } from "zod";

export const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const VARIANTS = ["us", "uk"] as const;
export type Cefr = (typeof CEFR)[number];
export type Variant = (typeof VARIANTS)[number];

const trimmed = z.string().transform((s) => s.trim());
/** absent field or empty string -> null (optional form fields) */
const opt = (schema: z.ZodTypeAny) =>
  z.string().optional().transform((s) => { const x = (s ?? "").trim(); return x === "" ? null : x; }).pipe(schema.nullable());

export const v = {
  name: trimmed.pipe(z.string().min(2).max(120)),
  email: trimmed.transform((s) => s.toLowerCase()).pipe(z.string().email().max(254)),
  optEmail: opt(z.string().email().max(254).transform((s) => s.toLowerCase())),
  optPhone: opt(z.string().regex(/^\+?[0-9 ]{6,20}$/)),
  optText: (max: number) => opt(z.string().max(max)),
  optDate: opt(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  optInt: (min: number, max: number) => opt(z.coerce.number().int().min(min).max(max)),
  optUuid: opt(z.string().uuid()),
  uuid: z.string().uuid(),
  cefr: z.enum(CEFR),
  variant: z.enum(VARIANTS),
  country: trimmed.transform((s) => s.toUpperCase()).pipe(z.string().regex(/^[A-Z]{2}$/)),
  checkbox: z.union([z.literal("on"), z.literal("true"), z.literal("1"), z.null(), z.undefined()]).transform((x) => x != null),
};

/** Reads a FormData into a plain object (multi-values ignored) for zod parsing. */
export function formObject(fd: FormData) {
  const o: Record<string, string> = {};
  fd.forEach((val, key) => {
    if (typeof val === "string" && !key.startsWith("$ACTION")) o[key] = val;
  });
  return o;
}

export function ageFrom(birth: string | null | undefined, now = new Date()) {
  if (!birth) return null;
  const b = new Date(birth + "T00:00:00Z");
  if (Number.isNaN(b.getTime())) return null;
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

/** Only same-site relative paths are accepted as redirect targets. */
export function safeNext(n: unknown, fallback = "/app") {
  const s = typeof n === "string" ? n : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}
