import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

/**
 * Envoi de la file SMS / WhatsApp via Twilio (si configuré). Sans fournisseur configuré,
 * les messages passent au statut « not_configured » : rien n'est présenté comme envoyé.
 */
export async function dispatchOutbox(admin: SupabaseClient, limit = 100) {
  const { sid, token, smsFrom, waFrom } = env.twilio();
  const { data: queue } = await admin.from("message_outbox").select("*").eq("status", "queued").in("channel", ["sms", "whatsapp"]).order("created_at").limit(limit);
  let sent = 0, failed = 0, skipped = 0;
  for (const m of queue ?? []) {
    const from = m.channel === "whatsapp" ? waFrom : smsFrom;
    if (!sid || !token || !from) {
      await admin.from("message_outbox").update({ status: "not_configured", error: "Aucun fournisseur SMS/WhatsApp configuré" }).eq("id", m.id);
      skipped++; continue;
    }
    const to = m.to_address.startsWith("+") ? m.to_address : `+${m.to_address.replace(/^0/, "243")}`;
    const body = new URLSearchParams({ From: m.channel === "whatsapp" ? `whatsapp:${from}` : from, To: m.channel === "whatsapp" ? `whatsapp:${to}` : to, Body: m.body });
    try {
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST", body, headers: { Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(15000),
      });
      const j = (await r.json().catch(() => ({}))) as { sid?: string; message?: string };
      if (r.ok) { await admin.from("message_outbox").update({ status: "sent", provider: "twilio", provider_ref: j.sid, sent_at: new Date().toISOString() }).eq("id", m.id); sent++; }
      else { await admin.from("message_outbox").update({ status: "failed", provider: "twilio", error: (j.message ?? String(r.status)).slice(0, 300) }).eq("id", m.id); failed++; }
    } catch (e) {
      await admin.from("message_outbox").update({ status: "failed", error: (e as Error).message.slice(0, 300) }).eq("id", m.id); failed++;
    }
  }
  return { sent, failed, skipped };
}
