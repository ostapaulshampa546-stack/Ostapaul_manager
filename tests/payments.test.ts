import { describe, expect, it } from "vitest";
import { CORRESPONDENTS, normalizeMsisdn } from "@/lib/payments/pawapay";

describe("Mobile Money", () => {
  it("normalise les numéros congolais", () => {
    expect(normalizeMsisdn("0812345678")).toBe("243812345678");
    expect(normalizeMsisdn("+243 99 123 4567")).toBe("243991234567");
    expect(normalizeMsisdn("812345678")).toBe("243812345678");
  });
  it("rejette les numéros invalides", () => {
    expect(() => normalizeMsisdn("12345")).toThrow();
  });
  it("couvre les trois opérateurs", () => {
    expect(Object.keys(CORRESPONDENTS).sort()).toEqual(["airtel_money", "mpesa", "orange_money"]);
  });
});
