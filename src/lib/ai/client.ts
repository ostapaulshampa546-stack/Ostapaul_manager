import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

export const AI_MODEL = "claude-opus-5-5";

export function aiClient() {
  const key = env.anthropicKey();
  if (!key) throw new Error("Assistant IA non configuré sur ce serveur (ANTHROPIC_API_KEY manquante).");
  return new Anthropic({ apiKey: key });
}
