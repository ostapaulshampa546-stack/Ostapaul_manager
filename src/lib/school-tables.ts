import { todayISO } from "@/lib/format";

export type StudentStat = {
  student_id: string; matricule: string | null; last_name: string; post_name: string | null; first_name: string; gender: string | null;
  birth_date: string | null; class_id: string | null; class_name: string | null; guardian_name: string | null; guardian_phone: string | null; status: string;
  days_class: number | null; days_present: number | null; days_late: number | null; days_excused: number | null; days_absent: number | null;
  attendance_rate: number | null; percentage: number | null; class_rank: number | null; courses_graded: number;
  due: number | null; paid: number | null; balance: number | null; overdue: number | null; currency: string;
};

/** Mois choisi (AAAA-MM) → bornes de dates ; par défaut le mois en cours. */
export function monthRange(month?: string) {
  const m = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : todayISO().slice(0, 7);
  const [y, mo] = m.split("-").map(Number);
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const to = `${m}-${String(last).padStart(2, "0")}`;
  const today = todayISO();
  return { month: m, from: `${m}-01`, to: to > today ? today : to, days: last };
}

export const MONTH_LABEL = (m: string) =>
  new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-15T00:00:00Z`));

/** Couleur d'un pourcentage (présence ou cote). */
export function tone(p: number | null | undefined, good = 75, warn = 50) {
  if (p === null || p === undefined) return "text-slate-300";
  return p >= good ? "text-emerald-600" : p >= warn ? "text-amber-600" : "text-red-600";
}

export const pct = (p: number | null | undefined) => (p === null || p === undefined ? "—" : `${Number(p).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`);

export const fullName = (s: Pick<StudentStat, "last_name" | "post_name" | "first_name">) =>
  [s.last_name?.toUpperCase(), s.post_name?.toUpperCase(), s.first_name].filter(Boolean).join(" ");
