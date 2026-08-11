import { describe, expect, it } from "vitest";
import { annualSavingMonths, PRICING_TIERS, TRIAL_DAYS } from "./pricing";

describe("PRICING_TIERS", () => {
  it("has unique plan codes", () => {
    const codes = PRICING_TIERS.map((tier) => tier.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("uses catalogue plan codes", () => {
    // These must match billing_plans.code, or signup preselects nothing.
    for (const tier of PRICING_TIERS) {
      expect(tier.code).toMatch(/^[a-z0-9][a-z0-9_]{0,39}$/);
    }
  });

  it("prices in whole rupees so display never rounds", () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.monthlyMinor % 100).toBe(0);
      if (tier.annualMinor !== null) expect(tier.annualMinor % 100).toBe(0);
    }
  });

  it("keeps annual cheaper than twelve months", () => {
    for (const tier of PRICING_TIERS) {
      if (tier.annualMinor === null) continue;
      expect(tier.annualMinor).toBeLessThan(tier.monthlyMinor * 12);
    }
  });

  it("orders tiers cheapest first", () => {
    const amounts = PRICING_TIERS.map((tier) => tier.monthlyMinor);
    expect([...amounts].sort((a, b) => a - b)).toEqual(amounts);
  });

  it("highlights exactly one tier", () => {
    expect(PRICING_TIERS.filter((tier) => tier.highlighted)).toHaveLength(1);
  });

  it("gives every tier at least one feature", () => {
    for (const tier of PRICING_TIERS) {
      expect(tier.features.length).toBeGreaterThan(0);
    }
  });

  it("offers a trial long enough to be worth advertising", () => {
    expect(TRIAL_DAYS).toBeGreaterThanOrEqual(7);
  });
});

describe("annualSavingMonths", () => {
  it("states the saving in whole months", () => {
    const clinic = PRICING_TIERS.find((tier) => tier.code === "clinic_monthly");
    expect(annualSavingMonths(clinic!)).toBe(2);
  });

  it("returns null for a tier with no annual option", () => {
    const solo = PRICING_TIERS.find((tier) => tier.code === "solo_monthly");
    expect(annualSavingMonths(solo!)).toBeNull();
  });
});
