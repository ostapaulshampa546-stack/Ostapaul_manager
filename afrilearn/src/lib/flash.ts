import "server-only";
import { redirect } from "next/navigation";

/** Post/Redirect/Get: every form works without JavaScript; the result is shown on the next page. */
export function back(path: string, flash: { ok?: string; error?: string } = {}): never {
  const [base, query = ""] = path.split("?");
  const q = new URLSearchParams(query);
  if (flash.ok) q.set("ok", flash.ok);
  if (flash.error) q.set("error", flash.error);
  const s = q.toString();
  redirect(s ? `${base}?${s}` : base);
}
