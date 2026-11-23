import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { getTenantContext } from "@/lib/context";
import { aiClient, AI_MODEL } from "@/lib/ai/client";
import { buildTools, systemPrompt } from "@/lib/ai/tools";

export const maxDuration = 120;

type Turn = { role: "user" | "assistant"; text: string };

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { tenantId?: string; history?: Turn[]; message?: string } | null;
  if (!body?.tenantId || !body.message || body.message.length > 2000) return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  const ctx = await getTenantContext(body.tenantId);
  if (!ctx.has("ai") || !ctx.can("ai.use")) return NextResponse.json({ error: "Assistant IA réservé à la formule Premium et aux utilisateurs autorisés." }, { status: 403 });

  let client: Anthropic;
  try { client = aiClient(); } catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 503 }); }
  const supabase = await createClient();
  const defs = buildTools(supabase, ctx);
  const tools = defs.map((d) => d.tool);

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...(body.history ?? []).slice(-12).filter((t) => t.text).map((t) => ({ role: t.role, content: t.text.slice(0, 4000) })),
    { role: "user", content: body.message },
  ];
  const used: string[] = [];
  try {
    for (let step = 0; step < 8; step++) {
      const res = await client.beta.messages.create({
        model: AI_MODEL, max_tokens: 16000, system: systemPrompt(ctx), tools, messages,
        betas: ["server-side-fallback-2026-07-01"], fallbacks: "default",
      });
      if (res.stop_reason === "refusal") return NextResponse.json({ answer: "Je ne peux pas répondre à cette demande.", tools: used });
      messages.push({ role: "assistant", content: res.content });
      if (res.stop_reason === "pause_turn") continue;
      const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (res.stop_reason !== "tool_use" || !calls.length) {
        const answer = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
        return NextResponse.json({ answer: answer || "(pas de réponse)", tools: used });
      }
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = await Promise.all(calls.map(async (c) => {
        const def = defs.find((d) => d.tool.name === c.name);
        used.push(c.name);
        if (!def) return { type: "tool_result" as const, tool_use_id: c.id, content: "Outil indisponible", is_error: true };
        try {
          const out = await def.run((c.input ?? {}) as Record<string, unknown>);
          return { type: "tool_result" as const, tool_use_id: c.id, content: JSON.stringify(out ?? null).slice(0, 60000) };
        } catch (e) {
          return { type: "tool_result" as const, tool_use_id: c.id, content: (e as Error).message, is_error: true };
        }
      }));
      messages.push({ role: "user", content: results });
    }
    return NextResponse.json({ answer: "Analyse trop longue, reformulez votre question.", tools: used });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "Service IA surchargé, réessayez dans un instant." }, { status: 429 });
    if (e instanceof Anthropic.APIError) return NextResponse.json({ error: `Erreur du service IA (${e.status ?? "?"})` }, { status: 502 });
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
