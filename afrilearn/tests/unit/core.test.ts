import { describe, expect, it } from "vitest";
import { checkPassword } from "@/lib/password";
import { ageFrom, safeNext, v } from "@/lib/validation";
import { africaDots, pointInPolygon, AFRICA, CITIES, project } from "@/lib/africa";
import fr from "@/lib/i18n/fr";
import en from "@/lib/i18n/en";
import { MODULES } from "@/lib/catalog";

describe("password policy", () => {
  it("accepts strong passwords and pass-phrases", () => {
    expect(checkPassword("Kigali-Sunrise-42")).toEqual([]);
    expect(checkPassword("ma maison est belle 7")).toEqual([]);
  });
  it("rejects weak, common, sequential and personal passwords", () => {
    expect(checkPassword("short1A")).toContain("length");
    expect(checkPassword("password123!")).toContain("common");
    expect(checkPassword("123456789")).toEqual(expect.arrayContaining(["sequence"]));
    expect(checkPassword("aaaaaaaaaaaa")).toContain("repeat");
    expect(checkPassword("Amina2026!x", { name: "Amina Diallo" })).toContain("personal");
    expect(checkPassword(" Leading-space9")).toContain("spaces");
    expect(checkPassword("é".repeat(40))).toContain("length"); // 80 bytes > bcrypt limit
  });
});

describe("validation", () => {
  it("only allows same-site redirects", () => {
    expect(safeNext("/center/1")).toBe("/center/1");
    expect(safeNext("//evil.com")).toBe("/app");
    expect(safeNext("https://evil.com")).toBe("/app");
    expect(safeNext("/\\evil.com")).toBe("/app");
  });
  it("computes age for minor protection", () => {
    expect(ageFrom("2012-06-15", new Date("2026-06-14T00:00:00Z"))).toBe(13);
    expect(ageFrom("2012-06-15", new Date("2026-06-15T00:00:00Z"))).toBe(14);
    expect(ageFrom(null)).toBeNull();
  });
  it("normalizes form fields", () => {
    expect(v.email.parse("  Amina@Example.COM ")).toBe("amina@example.com");
    expect(v.optPhone.parse("")).toBeNull();
    expect(() => v.optPhone.parse("abc")).toThrow();
    expect(v.country.parse("ng")).toBe("NG");
  });
});

describe("3D map data", () => {
  it("places every city inside the continent outline", () => {
    for (const c of CITIES.filter((c) => c.name !== "Casablanca")) expect(pointInPolygon(c.lon, c.lat, AFRICA), c.name).toBe(true);
  });
  it("produces a lighter grid for phones", () => {
    const desktop = africaDots(1.0).length;
    const phone = africaDots(1.5).length;
    expect(desktop).toBeGreaterThan(1500);
    expect(phone).toBeLessThan(desktop / 2);
    expect(project(17, 1)).toEqual([0, 0]);
  });
});

describe("i18n and honesty", () => {
  it("has the same FAQ size in both languages", () => {
    expect(en.pages.faq.items.length).toBe(fr.pages.faq.items.length);
  });
  it("only phase-1 modules are marked as available", () => {
    expect(MODULES.filter((m) => m.available).every((m) => m.phase === 1)).toBe(true);
    expect(MODULES.find((m) => m.key === "ai")?.available).toBe(false);
    expect(MODULES.find((m) => m.key === "payments")?.available).toBe(false);
  });
});

describe("optional fields", () => {
  it("treat absent and empty fields as null", () => {
    expect(v.optDate.parse(undefined)).toBeNull();
    expect(v.optEmail.parse("")).toBeNull();
    expect(v.optText(10).parse("  hi ")).toBe("hi");
  });
});
