/**
 * Presentation logic for billing state — copy, severity and deadline maths.
 *
 * Pure and free of `import "server-only"` on purpose: it is imported by client
 * components (the banner, the write gate) and it is the part of the billing UI
 * that unit tests can actually reach under the repo's node-only vitest setup.
 */

import type { BillingStatus } from "@/lib/workos-metadata";

export type BannerSeverity = "info" | "warning" | "danger";

export type BillingBannerContent = {
  severity: BannerSeverity;
  message: string;
  ctaLabel: string;
  /** Red states are not dismissible — the workspace is actually degraded. */
  dismissible: boolean;
};

/** Show the trial banner only once the end is close enough to act on. */
export const TRIAL_WARNING_DAYS = 3;

/**
 * Whole days from `now` until `deadline`, rounded up so "22 hours left" reads
 * as "1 day" rather than "0 days". Negative once the deadline has passed.
 */
export function daysUntil(deadline: string | null, now: Date): number | null {
  if (!deadline) return null;
  const target = new Date(deadline);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - now.getTime()) / 86_400_000);
}

/**
 * Whether writes are blocked.
 *
 * Advisory only — Spring is the boundary and answers this independently on
 * every request. This exists so the UI can disable a button before the user
 * clicks it, not to decide anything.
 */
export function isWriteBlocked(status: BillingStatus | null): boolean {
  return status === "read_only" || status === "cancelled";
}

/** Whether the tenant should be nudged toward paying. */
export function needsAttention(
  status: BillingStatus | null,
  deadline: string | null,
  now: Date,
): boolean {
  if (status === "past_due" || isWriteBlocked(status)) return true;
  if (status !== "trialing") return false;
  const remaining = daysUntil(deadline, now);
  return remaining !== null && remaining <= TRIAL_WARNING_DAYS;
}

/**
 * What the banner should say, or null when there is nothing worth interrupting
 * the clinician for.
 */
export function bannerFor(
  status: BillingStatus | null,
  deadline: string | null,
  now: Date,
): BillingBannerContent | null {
  if (!needsAttention(status, deadline, now)) return null;

  const remaining = daysUntil(deadline, now);

  switch (status) {
    case "trialing":
      return {
        severity: "info",
        message:
          remaining !== null && remaining > 0
            ? `Your free trial ends in ${plural(remaining, "day")}.`
            : "Your free trial ends today.",
        ctaLabel: "Choose a plan",
        dismissible: true,
      };

    case "past_due":
      return {
        severity: "warning",
        message:
          remaining !== null && remaining > 0
            ? `We couldn't collect your payment. Your workspace becomes read-only in ${plural(remaining, "day")}.`
            : "We couldn't collect your payment. Your workspace becomes read-only today.",
        ctaLabel: "Update payment method",
        dismissible: true,
      };

    case "read_only":
      return {
        severity: "danger",
        // Say what still works. A clinic that has lost write access has not
        // lost its records, and the copy should not imply otherwise.
        message:
          "Your workspace is read-only. You can still view and export everything.",
        ctaLabel: "Reactivate",
        dismissible: false,
      };

    case "cancelled":
      return {
        severity: "danger",
        message:
          "Your subscription was cancelled. Your data is safe and you can still view and export it.",
        ctaLabel: "Resubscribe",
        dismissible: false,
      };

    default:
      return null;
  }
}

/** Human label for a status, for the settings page summary. */
export function statusLabel(status: BillingStatus | null): string {
  switch (status) {
    case "trialing":
      return "Free trial";
    case "active":
      return "Active";
    case "past_due":
      return "Payment failed";
    case "read_only":
      return "Read-only";
    case "cancelled":
      return "Cancelled";
    default:
      return "Unknown";
  }
}

/** Minor units to a display string — 499900 paise becomes "₹4,999". */
export function formatAmount(amountMinor: number, currency = "INR"): string {
  const major = amountMinor / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    // Whole-rupee pricing; a trailing ".00" on every tier is just noise.
    minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
