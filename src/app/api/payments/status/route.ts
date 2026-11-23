import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyPayment } from "@/lib/payments/verify";

/** Vérification à la demande (bouton « Vérifier ») : l'utilisateur doit pouvoir lire ce paiement (RLS). */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const id = String(form.get("id") ?? "");
  const back = String(form.get("back") ?? "/app");
  const supabase = await createClient();
  const { data } = await supabase.from("payments").select("id").eq("id", id).maybeSingle();
  if (!data) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  let msg = "";
  try {
    const r = await verifyPayment(id, "poll");
    msg = r.status === "succeeded" ? "Paiement confirmé par l'opérateur." : r.status === "failed" ? "Paiement échoué." : "Toujours en attente de confirmation.";
  } catch (e) {
    msg = `Vérification impossible : ${(e as Error).message}`;
  }
  const url = new URL(back.startsWith("/") ? back : "/app", req.url);
  url.searchParams.set("success", msg);
  return NextResponse.redirect(url, { status: 303 });
}
