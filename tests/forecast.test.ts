import { describe, expect, it } from "vitest";
import { fillDays, forecast, linearTrend } from "@/lib/forecast";

describe("forecast", () => {
  it("détecte une tendance linéaire", () => {
    const t = linearTrend([10, 20, 30, 40]);
    expect(t.slope).toBeCloseTo(10);
    expect(t.intercept).toBeCloseTo(10);
  });
  it("complète les jours manquants", () => {
    const f = fillDays([{ d: "2026-01-02", v: 5 }], "2026-01-01", "2026-01-03");
    expect(f.map((p) => p.v)).toEqual([0, 5, 0]);
  });
  it("projette une série constante à l'identique", () => {
    const pts = fillDays([], "2026-01-01", "2026-01-28").map((p) => ({ ...p, v: 100 }));
    const r = forecast(pts, 7);
    expect(r.points).toHaveLength(7);
    expect(r.total).toBeCloseTo(700);
    expect(r.changeVsRecent).toBeCloseTo(0);
  });
  it("ne prévoit jamais de valeurs négatives", () => {
    const pts = [50, 40, 30, 20, 10, 0].map((v, i) => ({ d: `2026-01-0${i + 1}`, v }));
    expect(forecast(pts, 10).points.every((p) => p.v >= 0)).toBe(true);
  });
});
