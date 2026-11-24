import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { Flash } from "@/components/ui";
import { SubmitButton } from "@/components/client";
import { createClient, createPublicClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/errors";
import { back } from "@/lib/flash";
import { fmt, getI18n } from "@/lib/i18n";
import { getSession } from "@/lib/session";

type Preview = { center_name: string; role: "manager" | "teacher" | "student"; email_hint: string; expired: boolean; accepted: boolean } | null;

async function accept(fd: FormData) {
  "use server";
  const token = String(fd.get("token") ?? "");
  if (!/^[0-9a-f]{48}$/.test(token)) redirect("/");
  const { t } = await getI18n();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) back(`/invite/${token}`, { error: dbErrorMessage(t, error) });
  const r = data as { center_id: string; role: string };
  redirect(r.role === "manager" ? `/center/${r.center_id}` : r.role === "teacher" ? "/teach" : "/learn");
}

export default async function Invite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const { t } = await getI18n();
  const db = createPublicClient();
  const valid = /^[0-9a-f]{48}$/.test(token);
  const { data } = valid && db ? await db.rpc("invitation_preview", { p_token: token }) : { data: null };
  const inv = data as Preview;
  const session = await getSession();
  const next = encodeURIComponent(`/invite/${token}`);
  return (
    <main id="main" className="bg-night-grid flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <Logo />
        <h1 className="font-display mt-6 text-2xl font-bold">{t.invite.title}</h1>
        <div className="mt-4"><Flash error={sp.error} /></div>
        {!inv ? <p className="text-danger">{t.invite.invalid}</p>
          : inv.accepted ? <p className="text-muted">{t.invite.used}</p>
          : inv.expired ? <p className="text-muted">{t.invite.expired}</p>
          : (
            <>
              <p className="text-lg">{fmt(t.invite.text, { center: inv.center_name, role: t.enums.role[inv.role].toLowerCase() })}</p>
              <p className="mt-2 text-sm text-muted">{t.invite.sentTo} <strong>{inv.email_hint}</strong></p>
              {session ? (
                <form action={accept} className="mt-6"><input type="hidden" name="token" value={token} /><SubmitButton variant="gold" className="w-full">{t.invite.accept}</SubmitButton></form>
              ) : (
                <div className="mt-6 space-y-3">
                  <p className="text-sm text-muted">{t.invite.loginFirst}</p>
                  <div className="flex gap-2">
                    <Link href={`/login?next=${next}`} className="btn btn-primary flex-1">{t.common.login}</Link>
                    <Link href={`/register?profile=${inv.role === "student" ? "student" : "teacher"}&next=${next}`} className="btn btn-gold flex-1">{t.common.register}</Link>
                  </div>
                </div>
              )}
            </>
          )}
      </div>
    </main>
  );
}
