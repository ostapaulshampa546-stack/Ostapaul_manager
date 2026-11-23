import { getTenantContext } from "@/lib/context";
import { Empty, Locked, PageHeader } from "@/components/ui";
import { Scanner } from "./Scanner";

export const metadata = { title: "Scanner QR" };

export default async function ScannerPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const ctx = await getTenantContext(tenantId);
  if (!ctx.can("attendance.scan")) return <Empty>Permission de pointage requise.</Empty>;
  if (!ctx.has("attendance")) return <Locked feature="Pointage QR" tenantId={tenantId} tierLabel="Basique" />;
  return (
    <div>
      <PageHeader title="Scanner de présence" subtitle="Scannez la carte QR d'un élève, d'un enseignant ou d'un membre du personnel. Fonctionne hors connexion : les pointages sont synchronisés automatiquement." />
      <Scanner tenantId={tenantId} />
    </div>
  );
}
