"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { createClient } from "@/lib/supabase/client";
import { enqueueScan, pendingScans, removeScan, type QueuedScan } from "@/lib/offline/queue";

type Result = { ok: boolean; name?: string; detail?: string; status?: string; error?: string; offline?: boolean; at: string };

declare global {
  interface Window { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }
}

function extractToken(raw: string) {
  const m = raw.match(/\/v\/([a-f0-9]{32,})/i);
  return (m ? m[1] : raw).trim();
}

export function Scanner({ tenantId }: { tenantId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastRef = useRef<{ token: string; t: number }>({ token: "", t: 0 });
  const [event, setEvent] = useState<"in" | "out">("in");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [manual, setManual] = useState("");
  const eventRef = useRef(event);
  eventRef.current = event;

  const refreshPending = useCallback(async () => setPending((await pendingScans()).filter((s) => s.tenant_id === tenantId).length), [tenantId]);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    const items = (await pendingScans()).filter((s) => s.tenant_id === tenantId);
    if (!items.length) return;
    const supabase = createClient();
    const { data, error } = await supabase.rpc("record_scans_batch", {
      p_tenant: tenantId, p_device: navigator.userAgent.slice(0, 90),
      p_items: items.map((i) => ({ token: i.token, event: i.event, scanned_at: i.scanned_at, client_uuid: i.client_uuid })),
    });
    if (error) return;
    for (const r of data as { client_uuid: string; ok: boolean; error?: string }[]) {
      // les erreurs définitives (carte inconnue…) sont retirées de la file pour ne pas bloquer
      await removeScan(r.client_uuid);
    }
    await refreshPending();
  }, [tenantId, refreshPending]);

  const handle = useCallback(async (raw: string) => {
    const token = extractToken(raw);
    const now = Date.now();
    if (token === lastRef.current.token && now - lastRef.current.t < 4000) return; // anti double lecture
    lastRef.current = { token, t: now };
    const item: QueuedScan = { client_uuid: crypto.randomUUID(), tenant_id: tenantId, token, event: eventRef.current, scanned_at: new Date().toISOString() };
    const at = new Date().toLocaleTimeString("fr-FR");
    if (!navigator.onLine) {
      await enqueueScan(item);
      await refreshPending();
      setResults((r) => [{ ok: true, offline: true, name: "Enregistré hors ligne", detail: "Synchronisation au retour d'Internet", at }, ...r].slice(0, 20));
      navigator.vibrate?.(80);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase.rpc("record_scan", {
      p_tenant: tenantId, p_token: token, p_event: item.event, p_scanned_at: item.scanned_at, p_client_uuid: item.client_uuid,
      p_device: navigator.userAgent.slice(0, 90),
    });
    if (error) {
      if (/fetch|network/i.test(error.message)) {
        await enqueueScan(item); await refreshPending();
        setResults((r) => [{ ok: true, offline: true, name: "Réseau instable : mis en file", at }, ...r].slice(0, 20));
      } else setResults((r) => [{ ok: false, error: error.message, at }, ...r].slice(0, 20));
      return;
    }
    const d = data as { ok: boolean; name?: string; detail?: string; status?: string; error?: string };
    navigator.vibrate?.(d.ok ? 80 : [60, 40, 60]);
    setResults((r) => [{ ...d, at }, ...r].slice(0, 20));
  }, [tenantId, refreshPending]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); sync(); };
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    refreshPending();
    sync();
    const iv = setInterval(sync, 30000);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); clearInterval(iv); };
  }, [sync, refreshPending]);

  useEffect(() => {
    if (!running) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ["qr_code"] }) : null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        const tick = async () => {
          if (stopped) return;
          if (v.readyState >= 2) {
            let value: string | null = null;
            if (detector) {
              const codes = await detector.detect(v).catch(() => []);
              value = codes[0]?.rawValue ?? null;
            } else {
              const c = canvasRef.current!;
              const w = 480, h = Math.round((v.videoHeight / v.videoWidth) * 480) || 360;
              c.width = w; c.height = h;
              const g = c.getContext("2d", { willReadFrequently: true })!;
              g.drawImage(v, 0, 0, w, h);
              value = jsQR(g.getImageData(0, 0, w, h).data, w, h)?.data ?? null;
            }
            if (value) await handle(value);
          }
          raf = window.setTimeout(tick, 250) as unknown as number;
        };
        tick();
      } catch (e) {
        setResults((r) => [{ ok: false, error: "Caméra indisponible : " + (e as Error).message, at: "" }, ...r]);
        setRunning(false);
      }
    })();
    return () => { stopped = true; clearTimeout(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, [running, handle]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="card">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
            {(["in", "out"] as const).map((e) => (
              <button key={e} type="button" onClick={() => setEvent(e)} className={`rounded-md px-4 py-1.5 text-sm font-semibold ${event === e ? "bg-navy-900 text-white" : "text-navy-900"}`}>
                {e === "in" ? "Entrée" : "Sortie"}
              </button>
            ))}
          </div>
          <span className={`badge ${online ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{online ? "En ligne" : "Hors ligne"}</span>
          {pending > 0 && <button type="button" onClick={sync} className="badge bg-gold-100 text-navy-900">{pending} en attente · synchroniser</button>}
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-navy-950">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          {!running && <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">Caméra arrêtée</div>}
          <div className="pointer-events-none absolute inset-10 rounded-2xl border-4 border-gold-400/70" />
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <button type="button" onClick={() => setRunning((r) => !r)} className={`${running ? "btn-ghost" : "btn-primary"} mt-3 w-full`}>
          {running ? "Arrêter la caméra" : "📷 Démarrer le scanner"}
        </button>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (manual) { handle(manual); setManual(""); } }}>
          <input value={manual} onChange={(e) => setManual(e.target.value)} className="input" placeholder="Ou saisir / coller le code de la carte" />
          <button className="btn-ghost">Valider</button>
        </form>
      </div>
      <div className="card">
        <h2 className="mb-3 font-bold">Derniers pointages</h2>
        <ul className="space-y-2" aria-live="polite">
          {results.map((r, i) => (
            <li key={i} className={`rounded-lg border p-3 text-sm ${r.ok ? (r.offline ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50") : "border-red-200 bg-red-50"}`}>
              <div className="flex justify-between font-semibold">
                <span>{r.ok ? (r.offline ? "⏳" : "✅") : "❌"} {r.name ?? r.error}</span><span className="text-xs text-slate-500">{r.at}</span>
              </div>
              {r.detail && <div className="text-xs text-slate-600">{r.detail}</div>}
              {r.status === "late" && <div className="text-xs font-semibold text-orange-600">En retard</div>}
            </li>
          ))}
          {!results.length && <li className="text-sm text-slate-500">Aucun scan pour l&apos;instant.</li>}
        </ul>
      </div>
    </div>
  );
}
