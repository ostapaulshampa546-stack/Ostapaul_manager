import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPayment } from "@/lib/payments/verify";

/**
 * Callback pawaPay. Le contenu reçu n'est JAMAIS considéré comme preuve :
 * on ré-interroge l'API du prestataire (verifyPayment) avant toute mise à jour.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const depositId = typeof body.depositId === "string" ? body.depositId : "";
  if (!/^[0-9a-f-]{36}$/i.test(depositId)) return NextResponse.json({ ok: false }, { status: 400 });
  const admin = createAdminClient();
  await admin.from("payment_events").insert({ payment_id: null, provider: "pawapay", event_type: "callback", verified: false, payload: body });
  try {
    const r = await verifyPayment(depositId, "webhook");
    return NextResponse.json({ ok: true, status: r.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
