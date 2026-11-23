import { money } from "@/lib/format";

type Point = { label: string; a: number; b?: number };

/**
 * Barres groupées (2 séries max : recettes / dépenses), une seule échelle.
 * Couleurs validées (bleu électrique / or) ; tooltip natif au survol ; un tableau accompagne toujours le graphique.
 */
export function BarChart({ data, currency, seriesA = "Recettes", seriesB, height = 180 }: {
  data: Point[]; currency: string; seriesA?: string; seriesB?: string; height?: number;
}) {
  const W = 640, H = height, padL = 44, padB = 22, padT = 8;
  const max = Math.max(1, ...data.map((d) => Math.max(d.a, d.b ?? 0)));
  const innerW = W - padL - 4, innerH = H - padB - padT;
  const slot = innerW / Math.max(1, data.length);
  const two = seriesB !== undefined;
  const bw = Math.max(2, Math.min(18, (slot - 4) / (two ? 2 : 1) - 2));
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const ticks = [0, 0.5, 1].map((f) => max * f);
  const labelEvery = Math.ceil(data.length / 8);
  return (
    <figure>
      <div className="mb-2 flex gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#1E6BFF]" />{seriesA}</span>
        {two && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#D4A72C]" />{seriesB}</span>}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${seriesA}${two ? " et " + seriesB : ""}`}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="#64748b">{Math.round(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x0 = padL + i * slot + (slot - (two ? bw * 2 + 2 : bw)) / 2;
          return (
            <g key={i}>
              <rect x={padL + i * slot} y={padT} width={slot} height={innerH} fill="transparent">
                <title>{`${d.label} — ${seriesA} : ${money(d.a, currency)}${two ? ` · ${seriesB} : ${money(d.b ?? 0, currency)}` : ""}`}</title>
              </rect>
              <rect x={x0} y={y(d.a)} width={bw} height={Math.max(0, padT + innerH - y(d.a))} rx={2} fill="#1E6BFF" pointerEvents="none" />
              {two && <rect x={x0 + bw + 2} y={y(d.b ?? 0)} width={bw} height={Math.max(0, padT + innerH - y(d.b ?? 0))} rx={2} fill="#D4A72C" pointerEvents="none" />}
              {i % labelEvery === 0 && <text x={padL + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={10} fill="#64748b">{d.label}</text>}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
