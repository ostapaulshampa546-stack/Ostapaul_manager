import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { date } from "@/lib/format";

export const metadata = { title: "Vérification de carte", robots: { index: false } };

export default async function VerifyCard({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("verify_card", { p_token: token });
  const v = (data ?? { valid: false }) as { valid: boolean; name?: string; role?: string; matricule?: string; establishment?: string; expires_at?: string; tenant_id?: string; person_id?: string };
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-950 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <div className="flex justify-center"><Logo /></div>
        <div className={`mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full text-3xl ${v.valid ? "bg-emerald-100" : "bg-red-100"}`}>{v.valid ? "✓" : "✕"}</div>
        <h1 className="mt-3 text-xl font-bold">{v.valid ? "Carte valide" : v.name ? "Carte expirée ou révoquée" : "Carte inconnue"}</h1>
        {v.name && (
          <dl className="mt-4 space-y-1 text-sm">
            <div className="text-lg font-bold">{v.name}</div>
            <div className="text-slate-600">{v.role}</div>
            <div className="text-slate-500">Matricule {v.matricule}</div>
            <div className="text-slate-500">{v.establishment}</div>
            <div className="text-xs text-slate-400">Validité : {date(v.expires_at)}</div>
          </dl>
        )}
        {v.person_id && <p className="mt-4 text-xs text-slate-500">Vous êtes membre de cet établissement : utilisez le scanner de l&apos;application pour enregistrer la présence.</p>}
      </div>
    </main>
  );
}
