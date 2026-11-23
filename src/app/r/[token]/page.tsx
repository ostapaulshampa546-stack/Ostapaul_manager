import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { dateTime, METHOD_LABELS, money, STATUS_LABELS } from "@/lib/format";

export const metadata = { title: "Vérification de reçu", robots: { index: false } };

export default async function VerifyReceipt({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("verify_receipt", { p_token: token });
  const r = data as null | { valid: boolean; status: string; reference: string; receipt_number: string; amount: number; currency: string; method: string; paid_at: string; establishment: string };
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy-950 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
        <div className="flex justify-center"><Logo /></div>
        {!r ? <h1 className="mt-6 text-xl font-bold text-red-600">Reçu introuvable</h1> : (
          <>
            <div className={`mx-auto mt-6 flex h-16 w-16 items-center justify-center rounded-full text-3xl ${r.valid ? "bg-emerald-100" : "bg-amber-100"}`}>{r.valid ? "✓" : "!"}</div>
            <h1 className="mt-3 text-xl font-bold">{r.valid ? "Paiement authentique" : `Paiement ${STATUS_LABELS[r.status]?.toLowerCase()}`}</h1>
            <div className="mt-4 text-3xl font-extrabold">{money(r.amount, r.currency)}</div>
            <dl className="mt-3 space-y-1 text-sm text-slate-600">
              <div>{r.establishment}</div><div>{METHOD_LABELS[r.method]} · {dateTime(r.paid_at)}</div>
              <div className="font-mono text-xs">Réf. {r.reference}{r.receipt_number ? ` · Reçu ${r.receipt_number}` : ""}</div>
            </dl>
          </>
        )}
      </div>
    </main>
  );
}
