import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { menuUrl, qrSvg } from "@/lib/qr";

/** Affiche A4 à imprimer : QR du menu (entrée, comptoir, vitrine, flyers). */
export default async function MenuPoster({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const ctx = await getTenantContext(tenantId);
  if (ctx.tenant.sector !== "restaurant") notFound();
  const url = menuUrl(ctx.tenant.public_token);
  const svg = await qrSvg(url);
  return (
    <div>
      <PageHeader title="Affiche du QR menu" subtitle="Imprimez-la pour l'entrée, le comptoir ou la vitrine. Elle reste valable même quand le menu change."
        actions={<><Link href={`/t/${tenantId}/r/menu_items`} className="btn-ghost">← Menu</Link><PrintButton label="Imprimer l'affiche" /></>} />
      <div className="print-area mx-auto flex max-w-xl flex-col items-center rounded-3xl border-8 border-navy-900 bg-white p-10 text-center shadow-xl">
        <div className="text-sm font-bold uppercase tracking-[0.3em] text-gold-500">Bienvenue</div>
        <h1 className="mt-2 text-4xl font-extrabold text-navy-900">{ctx.tenant.name}</h1>
        <div className="mx-auto my-8 w-72" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="text-2xl font-bold text-navy-900">📱 Scannez pour voir notre menu</div>
        <p className="mt-2 text-slate-500">Plats, boissons et prix toujours à jour</p>
        {ctx.tenant.phone && <p className="mt-4 text-lg font-semibold">📞 {ctx.tenant.phone}</p>}
        <p className="mt-6 text-xs text-slate-400">Propulsé par OSTAPAUL MANAGER</p>
      </div>
    </div>
  );
}
