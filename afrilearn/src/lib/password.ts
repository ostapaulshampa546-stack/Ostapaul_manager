/**
 * AFRILEARN password policy (bcrypt-hashed by Supabase Auth).
 * 8–72 bytes, spaces allowed (pass-phrases). < 12 chars: 3 character classes; >= 12: 2.
 * Rejects common passwords, sequences, repetitions and passwords containing the name or e-mail.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72;
export type PasswordRule = "length" | "spaces" | "mix" | "common" | "repeat" | "sequence" | "personal";

const COMMON = new Set([
  "123456", "1234567", "12345678", "123456789", "1234567890", "111111", "000000", "00000000", "11111111", "123123",
  "654321", "password", "password1", "password123", "passw0rd", "motdepasse", "azerty", "azertyuiop", "azerty123",
  "qwerty", "qwertyuiop", "qwerty123", "abc123", "abcd1234", "iloveyou", "jetaime", "admin", "admin123", "welcome",
  "bienvenue", "letmein", "monkey", "dragon", "football", "sunshine", "master", "superman", "changeme", "secret",
  "test", "test123", "afrilearn", "afrilearn123", "english", "english123", "teacher", "student", "africa", "africa123",
  "lagos", "nairobi", "kinshasa", "dakar", "abidjan", "accra", "jesus", "jesus123", "princess", "football1",
]);
const SEQUENCES = ["0123456789", "abcdefghijklmnopqrstuvwxyz", "azertyuiop", "qsdfghjklm", "wxcvbn", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "");

function isSequence(p: string) {
  if (p.length < 4) return false;
  return SEQUENCES.some((seq) => seq.includes(p) || [...seq].reverse().join("").includes(p));
}

export function checkPassword(password: string, ctx: { email?: string; name?: string } = {}): PasswordRule[] {
  const errors = new Set<PasswordRule>();
  const len = [...password].length;
  if (len < PASSWORD_MIN || new TextEncoder().encode(password).length > PASSWORD_MAX) errors.add("length");
  if (/^\s|\s$/.test(password)) errors.add("spaces");
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if ((len < 12 && classes < 3) || (len >= 12 && classes < 2)) errors.add("mix");
  const n = normalize(password);
  const stripped = n.replace(/[0-9!@#$%^&*._\-+=?]+$/, "");
  if (COMMON.has(n) || COMMON.has(stripped)) errors.add("common");
  if (/^(.)\1+$/.test(n) || /^(.{1,3})\1{2,}$/.test(n)) errors.add("repeat");
  if (isSequence(n) || isSequence(stripped)) errors.add("sequence");
  const local = ctx.email?.split("@")[0];
  const parts = [local, ...(ctx.name ?? "").split(/\s+/)].filter((x): x is string => !!x && x.length >= 4).map(normalize);
  if (parts.some((p) => n.includes(p))) errors.add("personal");
  return [...errors];
}
