/**
 * Prévisions statistiques simples et explicables (pas d'IA générative) :
 * tendance linéaire (moindres carrés) × saisonnalité hebdomadaire.
 */
export type DayValue = { d: string; v: number };

export function linearTrend(values: number[]) {
  const n = values.length;
  if (n === 0) return { slope: 0, intercept: 0 };
  const xs = values.map((_, i) => i);
  const mx = (n - 1) / 2;
  const my = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (values[i] - my); den += (xs[i] - mx) ** 2; }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}

/** Complète les jours manquants avec 0 entre deux dates incluses. */
export function fillDays(points: DayValue[], from: string, to: string): DayValue[] {
  const map = new Map(points.map((p) => [p.d.slice(0, 10), p.v]));
  const out: DayValue[] = [];
  for (let t = Date.parse(from + "T00:00:00Z"); t <= Date.parse(to + "T00:00:00Z"); t += 86400000) {
    const d = new Date(t).toISOString().slice(0, 10);
    out.push({ d, v: map.get(d) ?? 0 });
  }
  return out;
}

export function weekdayFactors(points: DayValue[]) {
  const sums = Array(7).fill(0), counts = Array(7).fill(0);
  for (const p of points) { const w = new Date(p.d + "T00:00:00Z").getUTCDay(); sums[w] += p.v; counts[w]++; }
  const mean = points.reduce((a, p) => a + p.v, 0) / Math.max(1, points.length);
  return sums.map((s, i) => (counts[i] && mean > 0 ? s / counts[i] / mean : 1));
}

export function forecast(points: DayValue[], horizonDays: number) {
  const values = points.map((p) => p.v);
  const { slope, intercept } = linearTrend(values);
  const factors = weekdayFactors(points);
  const last = points.length ? Date.parse(points[points.length - 1].d + "T00:00:00Z") : Date.now();
  const out: DayValue[] = [];
  for (let h = 1; h <= horizonDays; h++) {
    const t = last + h * 86400000;
    const w = new Date(t).getUTCDay();
    const base = Math.max(0, intercept + slope * (values.length - 1 + h));
    out.push({ d: new Date(t).toISOString().slice(0, 10), v: Math.round(base * factors[w] * 100) / 100 });
  }
  const total = out.reduce((a, p) => a + p.v, 0);
  const recent = values.slice(-horizonDays).reduce((a, b) => a + b, 0);
  return { points: out, total: Math.round(total * 100) / 100, trendPerDay: Math.round(slope * 100) / 100, changeVsRecent: recent > 0 ? (total - recent) / recent : null };
}
