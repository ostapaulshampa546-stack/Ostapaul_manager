import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { qrSvg } from "@/lib/qr";
import { str } from "@/lib/server-actions";

async function save(fd: FormData) {
  "use server";
  const { user } = await requirePlatformAdmin();
  const supabase = await createClient();
  await supabase.from("platform_admins").update({ full_name: str(fd, "full_name"), title: str(fd, "title") || "Super Administrateur", phone: str(fd, "phone") || null,
    email: str(fd, "email") || null, address: str(fd, "address") || null }).eq("user_id", user.id);
  redirect("/admin/card");
}

export default async function AdminCard() {
  const { admin, user } = await requirePlatformAdmin();
  const vcard = ["BEGIN:VCARD", "VERSION:3.0", `FN:${admin.full_name ?? ""}`, `TITLE:${admin.title} — OSTAPAUL MANAGER`, "ORG:OSTAPAUL MANAGER",
    admin.phone ? `TEL;TYPE=CELL:${admin.phone}` : "", `EMAIL:${admin.email ?? user.email ?? ""}`, admin.address ? `ADR:;;${admin.address};;;;` : "", "END:VCARD"].filter(Boolean).join("\n");
  const svg = await qrSvg(vcard, "#0B1F4B");
  return (
    <div>
      <PageHeader title="Carte du Super Administrateur" subtitle="Le QR code contient votre fiche contact (vCard)." actions={<PrintButton label="Imprimer la carte" />} />
      <div className="grid gap-6 lg:grid-cols-2">
        <article className="print-area relative mx-auto flex h-[220px] w-[360px] overflow-hidden rounded-2xl bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 text-white shadow-xl">
          <div className="absolute right-0 top-0 h-full w-2 bg-gold-500" />
          <div className="flex flex-1 flex-col p-5">
            <div className="text-xs font-extrabold tracking-widest">OSTAPAUL <span className="text-gold-400">MANAGER</span></div>
            <div className="mt-1 text-[9px] uppercase tracking-[0.25em] text-gold-400">{admin.title}</div>
            <div className="mt-5 text-xl font-extrabold leading-tight">{admin.full_name ?? "—"}</div>
            <dl className="mt-2 space-y-0.5 text-[11px] text-white/80">
              {admin.phone && <div>📞 {admin.phone}</div>}<div>✉️ {admin.email ?? user.email}</div>{admin.address && <div>📍 {admin.address}</div>}
            </dl>
            <div className="mt-auto text-[9px] text-white/40">Un seul logiciel. Trois secteurs. Une gestion intelligente.</div>
          </div>
          <div className="flex w-[130px] items-center justify-center pr-3"><div className="rounded-lg bg-white p-1.5" style={{ width: 112 }} dangerouslySetInnerHTML={{ __html: svg }} /></div>
        </article>
        <form action={save} className="no-print card space-y-3">
          {([["full_name", "Nom complet", admin.full_name], ["title", "Titre", admin.title], ["phone", "Téléphone", admin.phone], ["email", "E-mail", admin.email ?? user.email], ["address", "Adresse", admin.address]] as const).map(([n, l, v]) => (
            <div key={n}><label className="label">{l}</label><input name={n} defaultValue={v ?? ""} className="input" /></div>
          ))}
          <button className="btn-primary">Mettre à jour</button>
        </form>
      </div>
    </div>
  );
}
