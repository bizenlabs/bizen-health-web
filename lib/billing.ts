import "server-only";
import { api } from "@/lib/api";

/**
 * Customer billing, backed by core's `/v1/billing/**`.
 *
 * Everything under that prefix is exempt from core's read-only write boundary —
 * it is the screen a lapsed tenant uses to pay, so gating it would lock them
 * out of the only thing that can unlock them.
 */

export type BillingSubscription = {
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "READ_ONLY" | "CANCELLED";
  planCode: string | null;
  planName: string | null;
  /** Set when a plan change is queued for the end of the current cycle. */
  pendingPlanCode: string | null;
  writable: boolean;
  readOnlyReason:
    | "TRIAL_ENDED"
    | "PAYMENT_FAILED"
    | "CANCELLED"
    | "PAUSED"
    | "PLAN_COMPLETED"
    | null;
  /** Trial end while trialing, grace end while past due. */
  deadline: string | null;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export type BillingPlan = {
  code: string;
  name: string;
  description: string | null;
  /** Minor units (paise). Never a float. */
  amountMinor: number;
  currency: string;
  billingPeriod: "MONTHLY" | "YEARLY";
  /** Null means unlimited. Blocks new invites only, never existing staff. */
  maxStaff: number | null;
  trialDays: number;
  /**
   * False until the tier has a Razorpay plan bound to it. Listable but not
   * buyable — the state every tier is in before merchant go-live.
   */
  purchasable: boolean;
};

export type BillingInvoice = {
  id: string;
  planCode: string | null;
  amountMinor: number;
  currency: string;
  status: "PAID" | "FAILED" | "REFUNDED";
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  method: string | null;
};

/**
 * The registered legal entity we bill, with the GST fields an Indian clinic
 * needs on its tax invoice. `stateCode` is place of supply and decides
 * CGST+SGST vs IGST — it cannot be corrected after invoicing, which is why
 * checkout refuses without it.
 */
export type BillingCustomerProfile = {
  legalName: string;
  gstin: string | null;
  billingAddress: string;
  stateCode: string;
  billingEmail: string | null;
};

export type CheckoutResponse = {
  /** Razorpay's hosted mandate page. Redirect the browser here. */
  shortUrl: string;
  razorpaySubscriptionId: string;
};

export const getSubscription = () =>
  api<BillingSubscription>("/v1/billing/subscription");

export const getPlans = () => api<BillingPlan[]>("/v1/billing/plans");

export const getInvoices = () => api<BillingInvoice[]>("/v1/billing/invoices");

export const getCustomerProfile = () =>
  api<BillingCustomerProfile | null>("/v1/billing/customer-profile");

export const saveCustomerProfile = (input: BillingCustomerProfile) =>
  api<BillingCustomerProfile>("/v1/billing/customer-profile", {
    method: "PUT",
    body: JSON.stringify(input),
  });

export const startCheckout = (planCode: string) =>
  api<CheckoutResponse>("/v1/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ planCode }),
  });

/**
 * Move to another plan at the end of the current cycle. Returns a hosted page
 * like checkout does: Razorpay cannot amend a UPI AutoPay or eMandate
 * subscription in place, so the customer re-authorizes at the new amount.
 */
export const changePlan = (planCode: string) =>
  api<CheckoutResponse>("/v1/billing/change-plan", {
    method: "POST",
    body: JSON.stringify({ planCode }),
  });

/** Cancel at the end of the paid period. Reads and exports continue after. */
export const cancelSubscription = () =>
  api<BillingSubscription>("/v1/billing/cancel", { method: "POST" });
