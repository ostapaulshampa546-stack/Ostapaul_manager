import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

/**
 * Chiffrement applicatif des données sensibles (AES-256-GCM, authentifié).
 * Les valeurs chiffrées sont stockées sous la forme « enc:v1:<base64(iv|tag|texte chiffré)> » :
 * illisibles dans la base, les sauvegardes et le tableau de bord Supabase.
 * La clé (ENCRYPTION_KEY, 64 caractères hexadécimaux) n'existe que côté serveur (Vercel).
 * ATTENTION : sans cette clé, les données chiffrées sont définitivement irrécupérables.
 */
const PREFIX = "enc:v1:";

function key(): Buffer {
  const hex = env.encryptionKey();
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
    throw new Error("Chiffrement indisponible : ENCRYPTION_KEY absente ou invalide (configuration serveur).");
  }
  return Buffer.from(hex, "hex");
}

export function isEncrypted(v: unknown): v is string {
  return typeof v === "string" && v.startsWith(PREFIX);
}

export function encryptField(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === "") return plain === "" ? null : (plain ?? null);
  if (isEncrypted(plain)) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64");
}

/** Déchiffre ; une valeur non chiffrée (données antérieures) est renvoyée telle quelle. */
export function decryptField(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (!isEncrypted(value)) return String(value);
  const raw = Buffer.from(value.slice(PREFIX.length), "base64");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
}

/** Version tolérante pour l'affichage : n'interrompt pas la page si une valeur est illisible. */
export function decryptForDisplay(value: unknown): string | null {
  try { return decryptField(value); } catch { return "🔒 (illisible)"; }
}

/** Empreinte non réversible (journal des connexions sans stocker l'e-mail). */
export function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}
