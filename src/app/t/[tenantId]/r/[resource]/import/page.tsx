import Link from "next/link";
import { notFound } from "next/navigation";
import { getTenantContext } from "@/lib/context";
import { createClient } from "@/lib/supabase/server";
import { getResource } from "@/lib/resources";
import { Empty, PageHeader } from "@/components/ui";
import { AUTO_CREATE, IMPORTABLE, MAX_IMPORT_ROWS } from "@/lib/import-config";
import { ImportWizard, type WizardField } from "./ImportWizard";

export default async function ImportPage({ params }: { params: Promise<{ tenantId: string; resource: string }> }) {
  const { tenantId, resource } = await params;
  const res = getResource(resource);
  if (!res || !IMPORTABLE.has(resource)) notFound();
  const ctx = await getTenantContext(tenantId);
  if (!res.sectors.includes(ctx.tenant.sector)) notFound();
  const back = `/t/${tenantId}/r/${res.key}`;
  if (!ctx.can(res.writePerm) || !ctx.active) {
    return <><PageHeader title={`Ajouter plusieurs : ${res.title}`} /><Empty>{ctx.active ? "Vous n'avez pas le droit d'ajouter des éléments ici." : "Établissement en lecture seule : renouvelez l'abonnement."} <Link href={back} className="font-semibold text-electric-600">Retour</Link></Empty></>;
  }

  const supabase = await createClient();
  const fields: WizardField[] = await Promise.all(res.fields.map(async (f) => {
    let choices: string[] | undefined;
    if (f.type === "relation" && f.relation) {
      let q = supabase.from(f.relation.table).select(f.relation.labelColumns.join(",")).eq("tenant_id", tenantId).limit(1000);
      for (const [k, v] of Object.entries(f.relation.filter ?? {})) q = q.eq(k, v);
      const { data } = await q;
      choices = ((data ?? []) as unknown as Record<string, unknown>[])
        .map((r) => f.relation!.labelColumns.map((c) => r[c]).filter(Boolean).join(" ")).filter(Boolean).sort((a, b) => a.localeCompare(b));
    }
    return {
      name: f.name, label: f.label, type: f.type, required: !!f.required, hint: f.hint, defaultValue: f.defaultValue,
      options: f.options, choices, autoCreate: f.relation ? AUTO_CREATE[f.relation.table]?.label : undefined, sensitive: !!f.sensitive,
    };
  }));

  return (
    <div>
      <PageHeader title={`Ajouter plusieurs ${res.title.toLowerCase()}`}
        subtitle={`Importez votre liste existante (Excel, CSV ou copier-coller) ou saisissez plusieurs lignes à la fois — jusqu'à ${MAX_IMPORT_ROWS} par envoi.`}
        actions={<Link href={back} className="btn-ghost">← Retour à la liste</Link>} />
      <ImportWizard tenantId={tenantId} resourceKey={res.key} title={res.title} singular={res.singular} fields={fields}
        cardType={res.cardType ?? null} backHref={back} cardsHref={res.cardType ? `/t/${tenantId}/cards?type=${res.cardType}` : null} />
    </div>
  );
}
