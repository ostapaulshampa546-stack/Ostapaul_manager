"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function setLocale(formData: FormData) {
  const locale = formData.get("locale") === "ln" ? "ln" : "fr";
  (await cookies()).set("locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const back = String(formData.get("back") ?? "/app");
  redirect(back.startsWith("/") ? back : "/app");
}
