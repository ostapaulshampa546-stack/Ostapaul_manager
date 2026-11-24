"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sha256 } from "@/lib/crypto";

const clip = (v: FormDataEntryValue | null, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** Demande de contact : anti-robot (champ piège) et 5 demandes / heure par adresse IP. */
export async function submitLead(fd: FormData) {
  const back = (k: "error" | "success", m: string) => redirect(`/contact?${k}=${encodeURIComponent(m)}#formulaire`);
  if (clip(fd.get("website"), 10)) back("success", "Merci ! Nous vous recontactons rapidement."); // robot
  const name = clip(fd.get("name"), 120);
  const phone = clip(fd.get("phone"), 40);
  const email = clip(fd.get("email"), 200).toLowerCase();
  const sector = clip(fd.get("sector"), 20);
  if (name.length < 2) back("error", "Indiquez votre nom.");
  if (!phone && !email) back("error", "Indiquez un téléphone ou un e-mail pour que nous puissions vous répondre.");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) back("error", "Adresse e-mail invalide.");
  if (phone && !/^[+\d][\d\s().-]{7,}$/.test(phone)) back("error", "Numéro de téléphone invalide.");

  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? "").trim();
  const ipHash = ip ? sha256(`lead:${ip}`) : null;
  const admin = createAdminClient();
  if (ipHash) {
    const { count } = await admin.from("leads").select("id", { count: "exact", head: true })
      .eq("ip_hash", ipHash).gt("created_at", new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= 5) back("error", "Trop de demandes envoyées. Réessayez plus tard ou écrivez-nous sur WhatsApp.");
  }
  const { error } = await admin.from("leads").insert({
    name, organization: clip(fd.get("organization"), 160) || null,
    sector: ["restaurant", "school", "pme", "other"].includes(sector) ? sector : null,
    phone: phone || null, email: email || null, message: clip(fd.get("message"), 2000) || null, ip_hash: ipHash,
  });
  if (error) back("error", "Envoi impossible pour le moment. Contactez-nous par téléphone ou WhatsApp.");
  back("success", "Merci ! Votre demande est bien reçue, nous vous recontactons rapidement.");
}
