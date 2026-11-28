import "server-only";
import QRCode from "qrcode";
import { env } from "@/lib/env";

export async function qrSvg(text: string, color = "#0B1F4B") {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: color, light: "#ffffff" } });
}

/** URL encodée dans les cartes : vérifiable par n'importe quel téléphone, lisible par le scanner de pointage. */
export const cardUrl = (token: string) => `${env.appUrl()}/v/${token}`;
export const tableUrl = (token: string) => `${env.appUrl()}/m/${token}`;
/** Menu de tout l'établissement (sans table), mis à jour automatiquement. */
export const menuUrl = (publicToken: string) => `${env.appUrl()}/menu/${publicToken}`;
export const receiptUrl = (token: string) => `${env.appUrl()}/r/${token}`;
