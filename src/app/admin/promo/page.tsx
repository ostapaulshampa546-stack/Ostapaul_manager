import { PageHeader } from "@/components/ui";
import { PromoDesign } from "./PromoDesign";
import { getPlatformInfo } from "@/lib/site";

const MESSAGES = [
  { sector: "Restaurant Manager", icon: "🍽️", title: "Vos tables commandent toutes seules", text: "QR code sur chaque table, suivi cuisine, caisse et Mobile Money.", accent: "#E8833A" },
  { sector: "School Manager", icon: "🎓", title: "Notes, bulletins et frais en un clic", text: "Cartes QR des élèves, présences hors connexion, rappels aux parents par WhatsApp.", accent: "#16A34A" },
  { sector: "PME Manager", icon: "💼", title: "Pilotez votre entreprise depuis votre téléphone", text: "Devis, factures, stocks, trésorerie et salaires. USD et CDF.", accent: "#1E6BFF" },
  { sector: "OSTAPAUL MANAGER", icon: "📲", title: "Orange Money, Airtel Money, M-Pesa", text: "Encaissez partout, contrôlez chaque franc grâce à la caisse intelligente.", accent: "#D4A72C" },
  { sector: "OSTAPAUL MANAGER", icon: "🛡️", title: "Zéro fuite dans votre caisse", text: "Écarts de caisse, doublons et accès suspects détectés automatiquement.", accent: "#D4A72C" },
  { sector: "OSTAPAUL MANAGER", icon: "✨", title: "Votre assistant IA de gestion", text: "Posez vos questions, obtenez rapports et prévisions sur vos vraies données.", accent: "#3B82FF" },
  { sector: "OSTAPAUL MANAGER", icon: "⏱️", title: "Essai gratuit de {trial}", text: "Restaurants, écoles, universités et PME de la RDC. Dès 20 $ / mois.", accent: "#D4A72C" },
];

/** Design publicitaire du jour : rotation quotidienne déterministe (gabarits de marque, sans génération d'image par IA). */
export default async function Promo({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const { d } = await searchParams;
  const day = d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Kinshasa" }).format(new Date());
  const n = Math.floor(Date.parse(day) / 86400000);
  const info = await getPlatformInfo();
  const raw = MESSAGES[((n % MESSAGES.length) + MESSAGES.length) % MESSAGES.length];
  const m = { ...raw, title: raw.title.replace("{trial}", info.trialLabel || "offert") };
  const layout = ((n % 3) + 3) % 3;
  return (
    <div>
      <PageHeader title="Design publicitaire du jour" subtitle={`${day} — un nouveau visuel de marque chaque jour, prêt à publier (format carré 1080×1080).`} />
      <form className="mb-4 flex gap-2"><input type="date" name="d" defaultValue={day} className="input w-auto" /><button className="btn-ghost">Voir</button></form>
      <PromoDesign message={m} layout={layout} cta={info.trialLabel ? `Essai gratuit ${info.trialLabel}` : "Essai gratuit"} />
    </div>
  );
}
