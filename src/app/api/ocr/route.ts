import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getTenantContext } from "@/lib/context";
import { aiClient, AI_MODEL } from "@/lib/ai/client";

export const maxDuration = 90;

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["document_type", "vendor", "date", "total", "currency", "tax", "items", "suggested_category", "notes"],
  properties: {
    document_type: { type: "string", enum: ["facture", "recu", "bon_de_commande", "document_administratif", "autre"] },
    vendor: { type: ["string", "null"], description: "Émetteur / fournisseur" },
    date: { type: ["string", "null"], description: "Date au format AAAA-MM-JJ si lisible" },
    total: { type: ["number", "null"] },
    currency: { type: ["string", "null"], enum: ["USD", "CDF", null] },
    tax: { type: ["number", "null"] },
    items: { type: "array", items: { type: "object", additionalProperties: false, required: ["description", "quantity", "unit_price", "total"],
      properties: { description: { type: "string" }, quantity: { type: ["number", "null"] }, unit_price: { type: ["number", "null"] }, total: { type: ["number", "null"] } } } },
    suggested_category: { type: "string", description: "Catégorie de dépense suggérée (Achats, Transport, Loyer, Électricité, Salaires, Divers…)" },
    notes: { type: "string", description: "Doutes de lecture ou champs illisibles" },
  },
} as const;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const tenantId = String(form.get("tenant") ?? "");
  const file = form.get("file");
  const ctx = await getTenantContext(tenantId);
  if (!ctx.has("ocr") || !ctx.can("ocr.use")) return NextResponse.json({ error: "Scanner intelligent réservé à la formule Premium." }, { status: 403 });
  if (!(file instanceof File) || file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Image manquante ou trop lourde (5 Mo max)." }, { status: 400 });
  const media = file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(media)) return NextResponse.json({ error: "Format accepté : JPEG, PNG, WebP." }, { status: 400 });
  let client: Anthropic;
  try { client = aiClient(); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 503 }); }
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  try {
    const res = await client.beta.messages.create({
      model: AI_MODEL, max_tokens: 8000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      output_config: { format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> } },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: media, data } },
        { type: "text", text: "Extrais les informations de ce document (contexte : RDC, montants en USD ou CDF/FC). Ne devine pas : mets null pour tout champ illisible et explique dans notes." },
      ] }],
    });
    if (res.stop_reason === "refusal") return NextResponse.json({ error: "Document non traité." }, { status: 422 });
    const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("");
    return NextResponse.json({ extracted: JSON.parse(text) });
  } catch (e) {
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: `Erreur du service IA (${e.status ?? "?"})` }, { status: 502 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
