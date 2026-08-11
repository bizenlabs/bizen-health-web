import type { Metadata } from "next";
import Link from "next/link";
import { formatAmount } from "@/lib/billing-status";
import { annualSavingMonths, PRICING_TIERS, TRIAL_DAYS } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing — Bizen Health",
  description:
    "Simple per-clinic pricing for AI dictation and patient records. Start with a free trial, no card required.",
};

export default function PricingPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="max-w-2xl">
        <h1 className="[font-family:var(--font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">
          Simple pricing, per clinic
        </h1>
        <p className="mt-4 text-lg text-[var(--m-muted)]">
          Start with a {TRIAL_DAYS}-day free trial. No card needed until you
          decide to stay — dictate a few real consultations first.
        </p>
      </div>

      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:max-w-4xl">
        {PRICING_TIERS.map((tier) => {
          const savingMonths = annualSavingMonths(tier);

          return (
            <section
              key={tier.code}
              className={
                tier.highlighted
                  ? "rounded-2xl border-2 border-[var(--m-green)] bg-white p-6"
                  : "rounded-2xl border border-[var(--m-line)] bg-white p-6"
              }
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{tier.name}</h2>
                {tier.highlighted ? (
                  <span className="rounded-full bg-[var(--m-panel)] px-2.5 py-1 text-xs font-medium text-[var(--m-green)]">
                    Most popular
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-sm text-[var(--m-muted)]">
                {tier.tagline}
              </p>

              <p className="mt-6">
                <span className="text-4xl font-semibold tracking-tight">
                  {formatAmount(tier.monthlyMinor)}
                </span>
                <span className="ml-1 text-sm text-[var(--m-muted)]">
                  /month
                </span>
              </p>

              {tier.annualMinor !== null && savingMonths ? (
                <p className="mt-1 text-sm text-[var(--m-muted)]">
                  or {formatAmount(tier.annualMinor)}/year — {savingMonths}{" "}
                  months free
                </p>
              ) : null}

              <p className="mt-4 text-sm text-[var(--m-muted)]">
                {tier.maxStaff === null
                  ? "Unlimited staff"
                  : `Up to ${tier.maxStaff} staff ${tier.maxStaff === 1 ? "member" : "members"}`}
              </p>

              <ul className="mt-6 space-y-2 text-sm">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span aria-hidden className="text-[var(--m-green)]">
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/sign-up"
                className="mt-8 inline-flex h-10 w-full items-center justify-center rounded-full bg-[var(--m-green)] px-4 text-sm font-medium text-white transition-colors hover:bg-[var(--m-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m-green)]"
              >
                Start free trial
              </Link>
            </section>
          );
        })}
      </div>

      <div className="mt-16 max-w-2xl">
        <h2 className="text-xl font-semibold">Questions</h2>
        <dl className="mt-6 space-y-6 text-sm">
          <div>
            <dt className="font-medium">Do I need a card to start?</dt>
            <dd className="mt-1 text-[var(--m-muted)]">
              No. The {TRIAL_DAYS}-day trial needs nothing but an email address.
              You choose a plan when the trial ends.
            </dd>
          </div>
          <div>
            <dt className="font-medium">What happens if I stop paying?</dt>
            <dd className="mt-1 text-[var(--m-muted)]">
              Your workspace becomes read-only. You keep full access to view,
              search and export every patient record — we never delete or
              withhold your clinical data over billing.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Are prices inclusive of GST?</dt>
            <dd className="mt-1 text-[var(--m-muted)]">
              Prices are exclusive of GST. Add your GSTIN in billing settings
              and we&apos;ll issue a tax invoice you can claim input credit
              against.
            </dd>
          </div>
          <div>
            <dt className="font-medium">Can I change plans later?</dt>
            <dd className="mt-1 text-[var(--m-muted)]">
              Yes. Changes take effect at the end of your current billing cycle,
              and you&apos;ll re-authorise your payment method at the new
              amount.
            </dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
