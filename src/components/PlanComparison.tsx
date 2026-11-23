import Link from "next/link";
import { COMPARISON_ROWS, FEATURE_LABELS, TIER_LABEL, usersLabel, type PlanRow, type Tier } from "@/lib/plans";

/** Comparaison en trois colonnes : Basique, Standard, Premium. */
export function PlanComparison({ plans, cta, currentTier }: {
  plans: PlanRow[];
  cta: (p: PlanRow) => { href?: string; label: string; form?: React.ReactNode };
  currentTier?: Tier;
}) {
  const ordered = (["basic", "standard", "premium"] as Tier[]).map((t) => plans.find((p) => p.tier === t)).filter(Boolean) as PlanRow[];
  let lastGroup = "";
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr>
            <th className="w-2/5 p-4 text-left align-bottom text-xs uppercase tracking-wide text-slate-500">Fonctionnalités</th>
            {ordered.map((p) => (
              <th key={p.id} className={`p-4 text-center align-top ${p.tier === "standard" ? "bg-electric-100/50" : ""} ${p.tier === "premium" ? "bg-gold-100/60" : ""}`}>
                {p.tier === "standard" && <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-electric-600">Le plus choisi</div>}
                {p.tier === "premium" && <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gold-500">Complet + IA</div>}
                <div className="text-lg font-bold text-navy-900">{TIER_LABEL[p.tier]}</div>
                <div className="mt-1 text-3xl font-extrabold text-navy-900">{Number(p.price_usd)} $<span className="text-sm font-medium text-slate-500"> / mois</span></div>
                <div className="mt-1 text-xs text-slate-500">{usersLabel(p.max_extra_users)}</div>
                <div className="mt-3">
                  {currentTier === p.tier ? (
                    <span className="badge bg-emerald-100 text-emerald-700">Formule actuelle</span>
                  ) : (() => {
                    const c = cta(p);
                    return c.form ?? <Link href={c.href ?? "#"} className={p.tier === "premium" ? "btn-gold w-full" : "btn-primary w-full"}>{c.label}</Link>;
                  })()}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row) => {
            const showGroup = row.group !== lastGroup;
            lastGroup = row.group;
            return [
              showGroup && (
                <tr key={`g-${row.group}`}><td colSpan={4} className="bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">{row.group}</td></tr>
              ),
              <tr key={row.feature} className="border-t border-slate-100">
                <td className="px-4 py-2.5 text-slate-700">{FEATURE_LABELS[row.feature]}</td>
                {ordered.map((p) => (
                  <td key={p.id} className="px-4 py-2.5 text-center">
                    {p.features.includes(row.feature)
                      ? <span className="font-bold text-emerald-600" aria-label="inclus">✓</span>
                      : <span className="text-slate-300" aria-label="non inclus">—</span>}
                  </td>
                ))}
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
