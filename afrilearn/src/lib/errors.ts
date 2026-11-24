import type { Dict } from "@/lib/i18n";

type PgError = { code?: string; message?: string; hint?: string | null; details?: string | null } | null | undefined;

/** Maps a database error to a user-facing message (never leaks SQL details). */
export function dbErrorMessage(t: Dict, error: PgError): string {
  if (!error) return t.common.errorGeneric;
  switch (error.hint) {
    case "class_full": return t.center.classFull;
    case "center_limit": return t.onboarding.limit;
    case "email": return t.center.inviteNeedsEmail;
    case "rate_limited": return t.pages.contact.rateLimited;
    case "self": return t.admin.selfError;
    case "last": return t.admin.lastAdmin;
    case "not_found": return t.admin.notFound;
    case "invalid": return t.invite.invalid;
    case "used": return t.invite.used;
    case "expired": return t.invite.expired;
    case "email_mismatch": return t.invite.mismatch;
    case "center": return t.invite.center;
  }
  if (error.code === "23505") return t.center.alreadyEnrolled;
  if (error.code === "42501" || error.code === "PGRST301") return t.common.notAllowed;
  if (error.code === "23514" || error.code === "22P02" || error.code === "22007") return t.common.errorGeneric;
  console.error("[db]", error.code, error.message);
  return t.common.errorGeneric;
}
