"use server";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/server";
import { getI18n } from "@/lib/i18n";
import { back } from "@/lib/flash";
import { dbErrorMessage } from "@/lib/errors";
import { formObject, v } from "@/lib/validation";

const schema = z.object({
  kind: z.enum(["contact", "center_demo", "partnership"]),
  full_name: v.name,
  email: v.email,
  phone: v.optPhone,
  organization: v.optText(120),
  country: z.string().optional(),
  message: z.string().trim().min(5).max(3000),
  website: z.string().max(0).optional(), // honeypot: bots fill it
});

export async function submitContact(fd: FormData) {
  const { t } = await getI18n();
  const parsed = schema.safeParse(formObject(fd));
  if (!parsed.success) back("/contact", { error: t.pages.contact.invalid });
  const d = parsed.data;
  const db = createPublicClient();
  if (!db) back("/contact", { error: t.common.dbNotConfigured });
  const { error } = await db.rpc("submit_lead", {
    p_kind: d.kind, p_full_name: d.full_name, p_email: d.email, p_message: d.message,
    p_phone: d.phone, p_organization: d.organization, p_country: d.country || null,
  });
  if (error) back("/contact", { error: dbErrorMessage(t, error) });
  back("/contact", { ok: t.pages.contact.sent });
}
