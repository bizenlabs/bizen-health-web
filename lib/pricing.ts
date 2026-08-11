/**
 * Marketing copy for the public pricing page.
 *
 * Deliberately separate from the live catalogue in core. This is what we say
 * publicly; `billing_plans` is what we actually charge. They are edited by
 * different people at different times, and a marketing tweak must never be able
 * to change a price, nor a public page depend on the API being reachable.
 *
 * `codes` link a tier to its catalogue entries so signup can preselect one.
 * Keep the amounts here in step with `0039-billing-plans.yaml`.
 */

export type PricingTier = {
  code: string;
  name: string;
  tagline: string;
  /** Minor units (paise), matching the catalogue. */
  monthlyMinor: number;
  /** Null when the tier has no annual option. */
  annualMinor: number | null;
  maxStaff: number | null;
  features: readonly string[];
  highlighted: boolean;
};

export const TRIAL_DAYS = 14;

export const PRICING_TIERS: readonly PricingTier[] = [
  {
    code: "solo_monthly",
    name: "Solo",
    tagline: "For a single practitioner.",
    monthlyMinor: 149900,
    annualMinor: null,
    maxStaff: 1,
    features: [
      "Unlimited dictation",
      "Structured clinical notes",
      "Prescriptions and letterhead printouts",
      "Patient records",
    ],
    highlighted: false,
  },
  {
    code: "clinic_monthly",
    name: "Clinic",
    tagline: "For a clinic with a team.",
    monthlyMinor: 499900,
    annualMinor: 4999000,
    maxStaff: 10,
    features: [
      "Everything in Solo",
      "Up to 10 staff members",
      "Shared note templates and vocabulary",
      "Clinic branding on documents",
    ],
    highlighted: true,
  },
] as const;

/** Months paid for on the annual plan — the honest version of "2 months free". */
export function annualSavingMonths(tier: PricingTier): number | null {
  if (tier.annualMinor === null) return null;
  return Math.round(12 - tier.annualMinor / tier.monthlyMinor);
}
