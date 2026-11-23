import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => { process.env.ENCRYPTION_KEY = "a".repeat(64); });

describe("chiffrement des données sensibles", async () => {
  const { encryptField, decryptField, isEncrypted, sha256 } = await import("@/lib/crypto");
  it("chiffre puis déchiffre", () => {
    const c = encryptField("Avenue du Commerce 12, Gombe")!;
    expect(isEncrypted(c)).toBe(true);
    expect(c).not.toContain("Gombe");
    expect(decryptField(c)).toBe("Avenue du Commerce 12, Gombe");
  });
  it("deux chiffrements du même texte diffèrent (IV aléatoire)", () => {
    expect(encryptField("x")).not.toBe(encryptField("x"));
  });
  it("détecte une valeur falsifiée", () => {
    const c = encryptField("secret")!;
    const tampered = c.slice(0, -4) + (c.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(() => decryptField(tampered)).toThrow();
  });
  it("laisse lisibles les anciennes valeurs non chiffrées", () => expect(decryptField("ancien texte")).toBe("ancien texte"));
  it("n'utilise pas l'e-mail en clair dans le journal", () => expect(sha256("a@b.cd")).toHaveLength(64));
});
