import { describe, expect, it } from "vitest";
import { checkPassword } from "@/lib/password";

describe("politique de mots de passe", () => {
  it.each(["123456", "12345678", "azertyuiop", "Password123", "motdepasse", "Kinshasa2024!", "aaaaaaaa", "abcabcabc", "qwerty123"])(
    "refuse le mot de passe facile %s", (p) => expect(checkPassword(p).ok).toBe(false));
  it("refuse moins de 8 caractères", () => expect(checkPassword("Ab1!xy").ok).toBe(false));
  it("accepte un mot de passe court mais varié", () => expect(checkPassword("Tq7#mZp2").ok).toBe(true));
  it("accepte une phrase de passe avec espaces et accents", () => expect(checkPassword("ma maison à Gombe est belle").ok).toBe(true));
  it("accepte les caractères spéciaux", () => expect(checkPassword("R@v1n€_Lukaya!").ok).toBe(true));
  it("refuse un mot de passe contenant l'e-mail", () => expect(checkPassword("Mukendi#2024x", { email: "mukendi@ex.cd" }).ok).toBe(false));
  it("refuse les espaces en début ou fin", () => expect(checkPassword(" Tq7#mZp2x").ok).toBe(false));
  it("refuse plus de 72 octets (limite bcrypt)", () => expect(checkPassword("Aa1!" + "x".repeat(80)).ok).toBe(false));
  it("refuse 12+ caractères d'un seul type", () => expect(checkPassword("bananeorangekiwi").ok).toBe(false));
});
