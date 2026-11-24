import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { getI18n } from "@/lib/i18n";
import { requireUser, spacesFor } from "@/lib/session";

/** Entry point after login: sends each role to its interface, or lets multi-role accounts choose. */
export default async function AppHome() {
  const s = await requireUser();
  const { t } = await getI18n();
  const spaces = spacesFor(s);
  if (spaces.length === 0 && s.profile.account_type === "center_manager") redirect("/onboarding");
  if (spaces.length === 1) redirect(spaces[0].href);
  if (spaces.length === 0) redirect("/learn");
  const labels = { admin: t.app.adminSpace, teacher: t.app.teacherSpace, student: t.app.studentSpace, center: t.app.centerSpace };
  const icons = { admin: "🛰️", center: "🏫", teacher: "👩🏾‍🏫", student: "🎒" };
  return (
    <main id="main" className="bg-night-grid flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl">
        <Logo />
        <h1 className="font-display mt-6 text-2xl font-bold">{t.app.chooseSpace}</h1>
        <p className="text-muted">{t.app.chooseSpaceSubtitle}</p>
        <ul className="mt-6 space-y-2">
          {spaces.map((sp) => (
            <li key={sp.href}>
              <Link href={sp.href} className="flex items-center gap-4 rounded-2xl border border-line p-4 hover:border-royal-500 hover:bg-royal-50">
                <span className="text-2xl" aria-hidden="true">{icons[sp.kind]}</span>
                <span><span className="block font-semibold">{labels[sp.kind]}</span>{sp.kind === "center" && <span className="text-sm text-muted">{sp.label} · {t.enums.role[sp.role!]}</span>}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-between text-sm"><Link href="/account" className="text-royal-600">{t.app.account}</Link><Link href="/onboarding" className="text-royal-600">+ {t.onboarding.submit}</Link></div>
      </div>
    </main>
  );
}
