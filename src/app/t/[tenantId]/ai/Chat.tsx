"use client";
import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; text: string; tools?: string[] };

export function Chat({ tenantId, suggestions, initial }: { tenantId: string; suggestions: string[]; initial?: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  async function ask(message: string) {
    if (!message.trim() || busy) return;
    const history = turns.map(({ role, text }) => ({ role, text }));
    setTurns((t) => [...t, { role: "user", text: message }]);
    setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/ai/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId, history, message }) });
      const j = await r.json();
      setTurns((t) => [...t, { role: "assistant", text: j.answer ?? `⚠️ ${j.error ?? "Erreur"}`, tools: j.tools }]);
    } catch {
      setTurns((t) => [...t, { role: "assistant", text: "⚠️ Connexion impossible. Réessayez quand le réseau est disponible." }]);
    } finally { setBusy(false); }
  }

  useEffect(() => { if (initial && !started.current) { started.current = true; ask(initial); } }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card flex min-h-[60vh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto">
        {!turns.length && (
          <div className="flex flex-wrap gap-2">{suggestions.map((s) => <button key={s} onClick={() => ask(s)} className="btn-ghost text-left">{s}</button>)}</div>
        )}
        {turns.map((t, i) => (
          <div key={i} className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm ${t.role === "user" ? "ml-auto bg-navy-900 text-white" : "bg-slate-100 text-navy-900"}`}>
            {t.text}
            {t.tools?.length ? <div className="mt-2 text-[10px] text-slate-500">Données consultées : {Array.from(new Set(t.tools)).join(", ")}</div> : null}
          </div>
        ))}
        {busy && <div className="w-fit rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">Analyse de vos données…</div>}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="mt-4 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} placeholder="Posez votre question…" className="input" />
        <button disabled={busy} className="btn-gold">Envoyer</button>
      </form>
    </div>
  );
}
