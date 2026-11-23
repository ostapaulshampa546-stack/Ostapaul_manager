import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { dispatchOutbox } from "@/lib/messaging/dispatch";
import { verifyPayment } from "@/lib/payments/verify";
import { isConfigured } from "@/lib/payments/pawapay";

function authorized(req: NextRequest) {
  const secret = env.cronSecret();
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || !got || got.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

/** Tâches planifiées : facturation des abonnements, automatisations, envoi SMS/WhatsApp, vérification des paiements en attente. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const out: Record<string, unknown> = {};
  out.billing = (await admin.rpc("billing_cycle")).data;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Kinshasa", hour: "2-digit", hour12: false }).format(new Date()));
  if (hour === 6 || req.nextUrl.searchParams.get("force") === "1") out.automations = (await admin.rpc("run_automations")).data;
  out.messages = await dispatchOutbox(admin);
  if (isConfigured()) {
    const { data: pending } = await admin.from("payments").select("id").eq("status", "pending").neq("method", "cash")
      .lt("created_at", new Date(Date.now() - 2 * 60000).toISOString()).gt("created_at", new Date(Date.now() - 2 * 86400000).toISOString()).limit(50);
    let checked = 0;
    for (const p of pending ?? []) { try { await verifyPayment(p.id, "poll"); checked++; } catch { /* réessai au prochain passage */ } }
    out.payments_checked = checked;
  }
  return NextResponse.json({ ok: true, ...out });
}
