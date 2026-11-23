"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SR = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onerror: () => void; onend: () => void; start: () => void };

/**
 * Assistant vocal : reconnaissance vocale du navigateur (français).
 * Le lingala n'est pas pris en charge par les moteurs de reconnaissance des navigateurs ;
 * quelques mots-clés lingala courants sont reconnus lorsqu'ils sont transcrits.
 */
const ROUTES: { re: RegExp; path: (m: RegExpMatchArray) => string }[] = [
  { re: /(ventes?|recettes?).*(jour|aujourd)|mbongo ya lelo/i, path: () => "/finance?g=day" },
  { re: /(rapport|bilan)/i, path: () => "/finance" },
  { re: /(stock|biloko)/i, path: () => "/stock" },
  { re: /(paiements?|transactions?|bofuti)/i, path: () => "/finance/payments" },
  { re: /(cherche|recherche|luka)[a-z]*\s+(l'|un |une |le |la )?(élève|eleve|étudiant|etudiant|mwana)\s+(.+)/i, path: (m) => `/r/students?q=${encodeURIComponent(m[4])}` },
  { re: /(présence|presence|pointage|bozali)/i, path: () => "/attendance" },
  { re: /(commande|bosenga)/i, path: () => "/restaurant/pos" },
];

export function VoiceButton({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "listening" | "unsupported">("idle");
  function listen() {
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) { setState("unsupported"); return; }
    const r = new Ctor();
    r.lang = "fr-FR"; r.interimResults = false;
    r.onresult = (e) => {
      const text = e.results[0][0].transcript.trim();
      const hit = ROUTES.map((x) => ({ x, m: text.match(x.re) })).find((h) => h.m);
      router.push(`/t/${tenantId}${hit ? hit.x.path(hit.m!) : `/ai?q=${encodeURIComponent(text)}`}`);
    };
    r.onerror = () => setState("idle");
    r.onend = () => setState("idle");
    setState("listening");
    r.start();
  }
  return (
    <button type="button" onClick={listen} className={`btn-ghost btn-sm ${state === "listening" ? "animate-pulse border-red-400 text-red-600" : ""}`}
      title={state === "unsupported" ? "Reconnaissance vocale non disponible sur ce navigateur" : "Commande vocale"}>
      🎙️{state === "listening" ? " J'écoute…" : ""}
    </button>
  );
}
