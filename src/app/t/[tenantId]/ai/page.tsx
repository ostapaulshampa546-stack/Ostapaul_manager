import { getTenantContext } from "@/lib/context";
import { Empty, Locked, PageHeader } from "@/components/ui";
import { Chat } from "./Chat";

export const metadata = { title: "Assistant IA" };

export default async function AiPage({ params, searchParams }: { params: Promise<{ tenantId: string }>; searchParams: Promise<{ q?: string }> }) {
  const { tenantId } = await params;
  const { q } = await searchParams;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.has("ai")) return <Locked feature="Assistant IA" tenantId={tenantId} tierLabel="Premium" />;
  if (!ctx.can("ai.use")) return <Empty>Votre rôle n&apos;a pas accès à l&apos;assistant.</Empty>;
  const suggestions = {
    restaurant: ["Quelles sont les ventes du jour ?", "Quels produits vont manquer cette semaine ?", "Analyse mes recettes et dépenses du mois et propose 3 actions."],
    school: ["Quel est le taux de recouvrement des frais par classe ?", "Recherche l'élève Kasongo", "Quels risques financiers vois-tu ce trimestre ?"],
    pme: ["Quels clients me doivent le plus ?", "Compare mes recettes des 4 dernières semaines.", "Y a-t-il des anomalies financières ?"],
  }[ctx.tenant.sector];
  return (
    <div>
      <PageHeader title="✨ Assistant IA" subtitle="Questions en langage naturel sur vos données réelles. L'assistant respecte vos permissions et n'invente pas de chiffres." />
      <Chat tenantId={tenantId} suggestions={suggestions} initial={q} />
    </div>
  );
}
