import { describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import { parseDelimited, templateCsv } from "@/lib/sheet-parse";
import { coerce, normalizeImported } from "@/lib/resource-values";
import { guessField } from "@/lib/import-config";
import { getResource } from "@/lib/resources";

const students = getResource("students")!;
const products = getResource("products")!;
const field = (r: typeof students, n: string) => r.fields.find((f) => f.name === n)!;
const val = (r: typeof students, n: string, raw: string) => coerce(field(r, n), normalizeImported(field(r, n), raw));

describe("lecture des tableaux", () => {
  it("CSV Excel français (;), guillemets et lignes vides", () => {
    expect(parseDelimited('﻿Nom;Prénom;Note\r\n"KABILA";"Jean ""JJ""";"a;b"\r\n\r\nMBUYI;Grâce;\r\n')).toEqual([
      ["Nom", "Prénom", "Note"], ["KABILA", 'Jean "JJ"', "a;b"], ["MBUYI", "Grâce", ""],
    ]);
  });
  it("copier-coller Excel (tabulations)", () => {
    expect(parseDelimited("Nom\tPrix\nRiz\t32\n")).toEqual([["Nom", "Prix"], ["Riz", "32"]]);
  });
  it("le modèle se relit à l'identique", () => {
    const csv = templateCsv(["Nom", "Prix"], [["Coca; 33 cl", "1"]]);
    expect(parseDelimited(csv)).toEqual([["Nom", "Prix"], ["Coca; 33 cl", "1"]]);
  });
});

describe("conversion des valeurs", () => {
  it("dates françaises, ISO et numéros Excel", () => {
    expect(val(students, "birth_date", "12/03/2012")).toBe("2012-03-12");
    expect(val(students, "birth_date", "2012-3-5")).toBe("2012-03-05");
    expect(val(students, "birth_date", "40980")).toBe("2012-03-12");
  });
  it("sexe en toutes lettres", () => {
    expect(val(students, "gender", "Masculin")).toBe("M");
    expect(val(students, "gender", "fille")).toBe("F");
    expect(val(students, "gender", "f")).toBe("F");
  });
  it("prix avec espaces, virgules et symboles", () => {
    expect(val(products, "sale_price", "1 250,50 $")).toBe(1250.5);
    expect(val(products, "sale_price", "1,250.50")).toBe(1250.5);
    expect(val(products, "sale_price", "15 000 FC")).toBe(15000);
    expect(val(products, "cost_price", "0,60")).toBe(0.6);
  });
  it("devises et oui/non", () => {
    expect(val(products, "currency", "FC")).toBe("CDF");
    expect(val(products, "currency", "dollars")).toBe("USD");
    expect(val(products, "is_active", "oui")).toBe(true);
    expect(val(products, "is_active", "non")).toBe(false);
  });
  it("refuse une date ou un nombre illisible", () => {
    expect(() => val(students, "birth_date", "hier")).toThrow(/date invalide/);
    expect(() => val(products, "sale_price", "gratuit")).toThrow();
  });
});

describe("reconnaissance des colonnes", () => {
  it("intitulés usuels, sans accents ni majuscules", () => {
    const used = new Set<string>();
    const map = ["NOM", "Post-nom", "Prénom", "Sexe", "Né le", "Classe", "Tél. parent"].map((h) => { const n = guessField(h, students.fields, used); if (n) used.add(n); return n; });
    expect(map).toEqual(["last_name", "post_name", "first_name", "gender", "birth_date", "class_id", "guardian_phone"]);
  });
  it("produits : désignation, PV, quantité", () => {
    const used = new Set<string>();
    expect(["Désignation", "PV", "Qté", "Réf"].map((h) => { const n = guessField(h, products.fields, used); if (n) used.add(n); return n; }))
      .toEqual(["name", "sale_price", "qty_on_hand", "sku"]);
  });
});

it("fflate disponible pour les .xlsx", () => {
  const z = zipSync({ "a.txt": strToU8("ok") });
  expect(z.length).toBeGreaterThan(0);
});
