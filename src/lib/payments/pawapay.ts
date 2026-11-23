import "server-only";
import { env } from "@/lib/env";

/**
 * Adaptateur pawaPay (agrégateur Mobile Money couvrant Orange Money, Airtel Money et Vodacom M-Pesa en RDC).
 * Référence : https://docs.pawapay.io (API v1 « deposits »). À valider sur le sandbox avec vos identifiants
 * avant la mise en production : les noms de « correspondents » et formats peuvent évoluer.
 */
export const CORRESPONDENTS: Record<string, string> = {
  orange_money: "ORANGE_COD",
  airtel_money: "AIRTEL_COD",
  mpesa: "VODACOM_MPESA_COD",
};

export function isConfigured() {
  return Boolean(env.pawapayToken());
}

/** Normalise un numéro congolais en MSISDN international sans « + » (ex. 243812345678). */
export function normalizeMsisdn(input: string) {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("243") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return "243" + digits.slice(1);
  if (digits.length === 9) return "243" + digits;
  throw new Error("Numéro Mobile Money invalide (format attendu : 08X XXX XXXX ou +243…)");
}

async function call(path: string, init?: RequestInit) {
  const token = env.pawapayToken();
  if (!token) throw new Error("Paiement Mobile Money non configuré (PAWAPAY_API_TOKEN manquant)");
  const res = await fetch(`${env.pawapayUrl()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!res.ok) throw new Error(`pawaPay ${res.status} : ${text.slice(0, 200)}`);
  return body;
}

export type DepositRequest = { depositId: string; amount: number; currency: "USD" | "CDF"; method: string; phone: string; description: string };

export async function initiateDeposit(r: DepositRequest) {
  const correspondent = CORRESPONDENTS[r.method];
  if (!correspondent) throw new Error("Moyen de paiement non pris en charge");
  const body = {
    depositId: r.depositId,
    amount: r.currency === "CDF" ? String(Math.round(r.amount)) : r.amount.toFixed(2),
    currency: r.currency,
    correspondent,
    payer: { type: "MSISDN", address: { value: normalizeMsisdn(r.phone) } },
    customerTimestamp: new Date().toISOString(),
    statementDescription: r.description.replace(/[^a-zA-Z0-9 ]/g, " ").slice(0, 22).padEnd(4, " "),
  };
  return (await call("/deposits", { method: "POST", body: JSON.stringify(body) })) as { depositId: string; status: string; rejectionReason?: unknown };
}

export type DepositStatus = { depositId: string; status: string; requestedAmount?: string; depositedAmount?: string; currency?: string; failureReason?: unknown };

/** Interroge le prestataire : seule source de vérité pour le statut d'un dépôt. */
export async function getDeposit(depositId: string): Promise<DepositStatus | null> {
  const body = await call(`/deposits/${encodeURIComponent(depositId)}`);
  const arr = Array.isArray(body) ? body : body ? [body] : [];
  return (arr[0] as DepositStatus) ?? null;
}
