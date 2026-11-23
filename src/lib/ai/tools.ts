import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TenantContext } from "@/lib/context";
import { todayISO } from "@/lib/format";

/**
 * Outils de l'assistant. Ils s'exécutent avec la session Supabase de l'utilisateur :
 * la RLS et les permissions s'appliquent, l'IA ne voit que ce que l'utilisateur peut voir.
 */
type ToolDef = { tool: Anthropic.Beta.BetaTool; perm?: string; sectors?: string[]; run: (input: Record<string, unknown>) => Promise<unknown> };

const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function buildTools(supabase: SupabaseClient, ctx: TenantContext): ToolDef[] {
  const t = ctx.tenant.id;
  const defs: ToolDef[] = [
    {
      tool: { name: "get_dashboard", description: "Indicateurs en temps réel de l'établissement : recettes du jour et du mois, dépenses, stocks bas, alertes, indicateurs du secteur et série des 30 derniers jours.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
      run: async () => (await supabase.rpc("dashboard_stats", { p_tenant: t })).data,
    },
    {
      tool: { name: "finance_report", description: "Rapport recettes / dépenses / bénéfice sur une période, par jour, semaine, mois ou année (devise de référence de l'établissement).", input_schema: {
        type: "object", additionalProperties: false, required: ["from", "to", "granularity"],
        properties: { from: { type: "string", description: "AAAA-MM-JJ" }, to: { type: "string", description: "AAAA-MM-JJ" }, granularity: { type: "string", enum: ["day", "week", "month", "year"] } } } },
      perm: "finance.read",
      run: async (i) => {
        if (!isDate(i.from) || !isDate(i.to)) return { error: "dates invalides" };
        const r = await supabase.rpc("finance_report", { p_tenant: t, p_from: i.from, p_to: i.to, p_granularity: i.granularity });
        return r.error ? { error: r.error.message } : r.data;
      },
    },
    {
      tool: { name: "recent_payments", description: "Dernières transactions (référence, montant, devise, moyen, statut, date).", input_schema: {
        type: "object", additionalProperties: false, properties: { status: { type: "string", enum: ["pending", "succeeded", "failed", "cancelled"] }, limit: { type: "integer", minimum: 1, maximum: 50 } } } },
      perm: "finance.read",
      run: async (i) => {
        let q = supabase.from("payments").select("reference, payable_type, amount, currency, method, status, payer_name, created_at, paid_at").eq("tenant_id", t).order("created_at", { ascending: false }).limit(Number(i.limit ?? 20));
        if (typeof i.status === "string") q = q.eq("status", i.status);
        return (await q).data;
      },
    },
    {
      tool: { name: "stock_status", description: "État des stocks : quantités, seuils, produits en rupture et estimation des jours restants (si disponible).", input_schema: { type: "object", properties: {}, additionalProperties: false } },
      sectors: ["restaurant", "pme"],
      run: async () => {
        const [p, f] = await Promise.all([
          supabase.from("products").select("name, qty_on_hand, min_qty, unit, sale_price, currency").eq("tenant_id", t).eq("is_active", true).order("name").limit(300),
          ctx.has("forecast") ? supabase.rpc("stock_forecast", { p_tenant: t }) : Promise.resolve({ data: null }),
        ]);
        return { products: p.data, forecast: f.data };
      },
    },
    {
      tool: { name: "fraud_alerts", description: "Alertes anti-fraude ouvertes (doublons, écarts de caisse, accès non autorisés…).", input_schema: { type: "object", properties: {}, additionalProperties: false } },
      perm: "audit.read",
      run: async () => (await supabase.from("fraud_alerts").select("kind, severity, title, details, created_at").eq("tenant_id", t).eq("status", "open").limit(50)).data,
    },
    {
      tool: { name: "search_students", description: "Rechercher un élève/étudiant par nom, postnom, prénom ou matricule ; renvoie classe, parent et solde des frais.", input_schema: {
        type: "object", additionalProperties: false, required: ["query"], properties: { query: { type: "string" } } } },
      sectors: ["school"], perm: "academic.read",
      run: async (i) => {
        const s = String(i.query ?? "").replace(/[%,()*]/g, " ").slice(0, 50);
        const { data } = await supabase.from("students").select("id, matricule, first_name, post_name, last_name, status, guardian_name, guardian_phone, classes(name)")
          .eq("tenant_id", t).or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,post_name.ilike.%${s}%,matricule.ilike.%${s}%`).limit(10);
        const ids = (data ?? []).map((x) => x.id);
        const bal = ids.length && ctx.can("fees.read") ? (await supabase.from("student_balances").select("student_id, currency, balance, overdue").in("student_id", ids)).data : [];
        return { students: data, balances: bal };
      },
    },
    {
      tool: { name: "school_overview", description: "Classes avec effectifs et soldes des frais scolaires par classe.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
      sectors: ["school"], perm: "fees.read",
      run: async () => {
        const [c, b] = await Promise.all([
          supabase.from("classes").select("id, name, level").eq("tenant_id", t),
          supabase.from("student_balances").select("class_id, currency, total_due, total_paid, balance, overdue").eq("tenant_id", t).limit(5000),
        ]);
        return { classes: c.data, balances_by_student: b.data };
      },
    },
    {
      tool: { name: "open_orders", description: "Commandes restaurant en cours (non payées) avec leur statut et total.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
      sectors: ["restaurant"], perm: "orders.write",
      run: async () => (await supabase.from("orders").select("number, status, order_type, total, paid_amount, currency, created_at").eq("tenant_id", t).not("status", "in", "(paid,cancelled)").limit(100)).data,
    },
    {
      tool: { name: "receivables", description: "Créances clients (factures émises non soldées) et dettes fournisseurs.", input_schema: { type: "object", properties: {}, additionalProperties: false } },
      sectors: ["pme"], perm: "sales.read",
      run: async () => {
        const [c, e] = await Promise.all([
          supabase.from("customer_balances").select("name, currency, total_invoiced, total_paid, balance, overdue").eq("tenant_id", t).gt("balance", 0),
          supabase.from("expenses").select("category, description, amount, currency, due_date").eq("tenant_id", t).eq("status", "unpaid"),
        ]);
        return { customers: c.data, supplier_debts: e.data };
      },
    },
  ];
  return defs.filter((d) => (!d.perm || ctx.can(d.perm)) && (!d.sectors || d.sectors.includes(ctx.tenant.sector)));
}

export function systemPrompt(ctx: TenantContext) {
  return `Tu es l'assistant de gestion d'OSTAPAUL MANAGER pour l'établissement « ${ctx.tenant.name} » (secteur : ${ctx.tenant.sector}, ville : ${ctx.tenant.city ?? "RDC"}).
Date du jour (Kinshasa) : ${todayISO()}. Devise de référence : ${ctx.tenant.base_currency} (1 USD = ${ctx.tenant.cdf_per_usd} CDF).

Règles impératives :
- Tu ne réponds qu'à partir des données renvoyées par les outils. N'invente jamais de chiffres, de noms ou de faits. Si une donnée manque, dis-le clairement et indique où la saisir.
- Les outils respectent les permissions de l'utilisateur : si un outil n'est pas disponible ou renvoie une erreur, explique que l'utilisateur n'y a pas accès.
- Les paiements « pending » ne sont pas des recettes confirmées.
- Pour les prévisions, explique la méthode (tendance observée) et la marge d'incertitude ; ne présente jamais une prévision comme une certitude.
- Réponds en français simple et professionnel (ou en lingala si l'utilisateur écrit en lingala), avec des montants formatés et, si utile, une courte liste de recommandations concrètes.
- Tu ne peux pas modifier les données : propose à l'utilisateur la page de l'application où agir.`;
}
