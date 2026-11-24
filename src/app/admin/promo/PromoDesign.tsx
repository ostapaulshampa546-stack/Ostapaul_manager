"use client";
import { useRef } from "react";

type M = { sector: string; icon: string; title: string; text: string; accent: string };

function wrap(text: string, max: number) {
  const words = text.split(" "); const lines: string[] = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > max) { lines.push(cur.trim()); cur = w; } else cur += " " + w; }
  if (cur.trim()) lines.push(cur.trim());
  return lines;
}

export function PromoDesign({ message: m, layout, cta }: { message: M; layout: number; cta: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const title = wrap(m.title, 20), text = wrap(m.text, 38);
  function download(kind: "svg" | "png") {
    const svg = new XMLSerializer().serializeToString(ref.current!);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    if (kind === "svg") { const a = document.createElement("a"); a.href = url; a.download = "ostapaul-promo.svg"; a.click(); return; }
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = 1080; c.height = 1080;
      c.getContext("2d")!.drawImage(img, 0, 0, 1080, 1080);
      const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = "ostapaul-promo.png"; a.click();
    };
    img.src = url;
  }
  const bg = layout === 1 ? "#ffffff" : "#0B1F4B";
  const fg = layout === 1 ? "#0B1F4B" : "#ffffff";
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,560px)_1fr]">
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" className="w-full rounded-2xl shadow-xl">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#050f2a" /><stop offset="1" stopColor="#1a3f8f" /></linearGradient></defs>
        <rect width="1080" height="1080" fill={layout === 2 ? "url(#g)" : bg} />
        {layout === 0 && <circle cx="900" cy="180" r="320" fill={m.accent} opacity="0.18" />}
        {layout === 1 && <rect x="0" y="0" width="1080" height="24" fill="#D4A72C" />}
        {layout === 2 && <path d="M0 860 Q540 700 1080 860 V1080 H0Z" fill={m.accent} opacity="0.25" />}
        <circle cx="140" cy="150" r="56" fill="none" stroke="#1E6BFF" strokeWidth="16" /><path d="M140 94a56 56 0 0 1 56 56" fill="none" stroke="#D4A72C" strokeWidth="16" strokeLinecap="round" />
        <text x="220" y="140" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="40" fill={fg}>OSTAPAUL</text>
        <text x="220" y="185" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="32" fill="#D4A72C">MANAGER</text>
        <text x="90" y="350" fontFamily="Arial, Helvetica, sans-serif" fontSize="34" fontWeight="700" fill={m.accent} letterSpacing="4">{m.sector.toUpperCase()}</text>
        <text x="90" y="300" fontSize="70">{m.icon}</text>
        {title.map((l, i) => <text key={i} x="90" y={460 + i * 92} fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="82" fill={fg}>{l}</text>)}
        {text.map((l, i) => <text key={i} x="90" y={480 + title.length * 92 + 40 + i * 52} fontFamily="Arial, Helvetica, sans-serif" fontSize="40" fill={fg} opacity="0.8">{l}</text>)}
        <rect x="90" y="910" width="470" height="90" rx="45" fill="#D4A72C" />
        <text x="325" y="968" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="36" fill="#050f2a">{cta}</text>
        <text x="990" y="968" textAnchor="end" fontFamily="Arial, Helvetica, sans-serif" fontSize="30" fill={fg} opacity="0.7">Kinshasa · RDC</text>
      </svg>
      <div className="space-y-2">
        <button onClick={() => download("png")} className="btn-gold w-full">⬇️ Télécharger en PNG</button>
        <button onClick={() => download("svg")} className="btn-ghost w-full">⬇️ Télécharger en SVG (vectoriel)</button>
        <p className="text-xs text-slate-500">Visuel généré à partir des gabarits de la charte (bleu marine, blanc, bleu électrique, or). Il change automatiquement chaque jour ; choisissez une date pour prévisualiser d&apos;autres visuels.</p>
      </div>
    </div>
  );
}
