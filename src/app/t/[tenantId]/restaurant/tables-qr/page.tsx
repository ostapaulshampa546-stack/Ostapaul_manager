import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { Empty, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";
import { qrSvg, tableUrl } from "@/lib/qr";

export default async function TablesQR({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const ctx = await getTenantContext(tenantId);
  const supabase = await createClient();
  const { data: tables } = await supabase.from("dining_tables").select("id, label, zone, qr_token").eq("tenant_id", tenantId).eq("is_active", true).order("label");
  const items = await Promise.all((tables ?? []).map(async (t) => ({ ...t, svg: await qrSvg(tableUrl(t.qr_token)) })));
  return (
    <div>
      <PageHeader title="QR codes des tables" subtitle="À imprimer et poser sur chaque table : le client scanne, consulte le menu et commande." actions={<PrintButton />} />
      {!items.length ? <Empty>Créez d&apos;abord vos tables.</Empty> : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {items.map((t) => (
            <div key={t.id} className="print-area card text-center" style={{ breakInside: "avoid" }}>
              <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{ctx.tenant.name}</div>
              <div className="mx-auto my-2 w-40" dangerouslySetInnerHTML={{ __html: t.svg }} />
              <div className="text-xl font-extrabold">Table {t.label}</div>
              <div className="text-xs text-slate-500">Scannez pour voir le menu et commander</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
