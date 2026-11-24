"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getI18n } from "@/lib/i18n";
import { back } from "@/lib/flash";
import { dbErrorMessage } from "@/lib/errors";
import { formObject, v } from "@/lib/validation";

const schema = z.object({ name: v.name, country: v.country, city: v.optText(80), phone: v.optPhone, email: v.optEmail });

export async function createCenter(fd: FormData) {
  const s = await requireUser("/onboarding");
  const { t } = await getI18n();
  const p = schema.safeParse(formObject(fd));
  if (!p.success) back("/onboarding", { error: t.common.errorGeneric });
  const { data, error } = await s.supabase.rpc("create_center", {
    p_name: p.data.name, p_country: p.data.country, p_city: p.data.city, p_phone: p.data.phone, p_email: p.data.email,
  });
  if (error) back("/onboarding", { error: dbErrorMessage(t, error) });
  redirect(`/center/${data}`);
}
