import Link from "next/link";
import { menuUrl, qrSvg } from "@/lib/qr";

/** QR code du menu du restaurant : créé automatiquement, toujours à jour avec les plats enregistrés. */
export async function MenuQrCard({ tenantId, publicToken, items }: { tenantId: string; publicToken: string; items: number }) {
  const url = menuUrl(publicToken);
  const svg = await qrSvg(url);
  return (
    <div className="no-print card mb-5 flex flex-col items-center gap-4 border-gold-300 bg-gradient-to-r from-amber-50 to-white sm:flex-row">
      <div className="w-32 shrink-0 rounded-lg bg-white p-2 shadow" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="flex-1 text-center sm:text-left">
        <h2 className="font-bold">📱 QR code de votre menu — généré automatiquement</h2>
        <p className="mt-1 text-sm text-slate-600">
          {items ? `Vos ${items} plat(s) et boisson(s) disponibles y apparaissent tout de suite.` : "Ajoutez vos plats : ils apparaîtront automatiquement."}
          {" "}Chaque ajout, changement de prix ou plat épuisé est mis à jour sans réimprimer le QR.
        </p>
        <p className="mt-1 break-all text-xs text-slate-400">{url}</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
          <Link href={`/t/${tenantId}/restaurant/menu-qr`} className="btn-gold btn-sm">🖨️ Imprimer l&apos;affiche</Link>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">Voir le menu comme un client</a>
          <a href={`https://wa.me/?text=${encodeURIComponent(`Découvrez notre menu : ${url}`)}`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">💬 Partager sur WhatsApp</a>
          <Link href={`/t/${tenantId}/restaurant/tables-qr`} className="btn-ghost btn-sm">🪑 QR des tables (commande)</Link>
        </div>
      </div>
    </div>
  );
}
