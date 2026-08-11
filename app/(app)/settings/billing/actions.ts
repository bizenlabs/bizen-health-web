"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, UnauthorizedError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import {
  cancelSubscription,
  changePlan,
  saveCustomerProfile,
  startCheckout,
  type BillingCustomerProfile,
} from "@/lib/billing";

export type ActionResult = { ok: true } | { ok: false; error: string };

const PLAN_CODE_RE = /^[a-z0-9][a-z0-9_]{0,39}$/;
const GSTIN_RE = /^[0-9A-Za-z]{15}$/;
const STATE_CODE_RE = /^[0-9]{2}$/;

async function run(work: () => Promise<void>): Promise<ActionResult> {
  try {
    await work();
    return { ok: true };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return {
      ok: false,
      error:
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong",
    };
  }
}

/**
 * Begin a subscription: create it at Razorpay, then send the browser to the
 * hosted mandate page.
 *
 * Note the redirect sits outside the try/catch. `redirect()` works by throwing,
 * so calling it inside would have `run()` swallow it and report a bogus error
 * instead of navigating.
 */
export async function startCheckoutAction(
  planCode: string,
): Promise<ActionResult> {
  await requireRole("tenant_admin", "super_admin");
  if (!PLAN_CODE_RE.test(planCode)) {
    return { ok: false, error: "Invalid plan" };
  }

  let shortUrl: string;
  try {
    ({ shortUrl } = await startCheckout(planCode));
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: "Couldn't start checkout. Please try again." };
  }
  redirect(shortUrl);
}

/**
 * Switch plans at the end of the current cycle. Also returns a hosted page:
 * Razorpay can't amend a UPI AutoPay or eMandate subscription in place, so the
 * customer re-authorizes at the new amount.
 */
export async function changePlanAction(
  planCode: string,
): Promise<ActionResult> {
  await requireRole("tenant_admin", "super_admin");
  if (!PLAN_CODE_RE.test(planCode)) {
    return { ok: false, error: "Invalid plan" };
  }

  let shortUrl: string;
  try {
    ({ shortUrl } = await changePlan(planCode));
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return { ok: false, error: "Couldn't change your plan. Please try again." };
  }
  redirect(shortUrl);
}

export async function cancelSubscriptionAction(): Promise<ActionResult> {
  await requireRole("tenant_admin", "super_admin");
  return run(async () => {
    await cancelSubscription();
    revalidatePath("/settings/billing");
  });
}

/**
 * Save the tax/billing profile.
 *
 * `stateCode` is place of supply under Indian GST: it decides CGST+SGST vs
 * IGST and cannot be corrected once invoices have been issued, which is why
 * checkout refuses to proceed without it.
 */
export async function saveCustomerProfileAction(
  input: BillingCustomerProfile,
): Promise<ActionResult> {
  await requireRole("tenant_admin", "super_admin");

  const legalName = input.legalName?.trim() ?? "";
  const billingAddress = input.billingAddress?.trim() ?? "";
  const stateCode = input.stateCode?.trim() ?? "";
  const gstin = input.gstin?.trim().toUpperCase() ?? "";
  const billingEmail = input.billingEmail?.trim() ?? "";

  if (legalName.length < 2 || legalName.length > 200) {
    return { ok: false, error: "Enter the registered legal name" };
  }
  if (!billingAddress) {
    return { ok: false, error: "Enter a billing address" };
  }
  if (!STATE_CODE_RE.test(stateCode)) {
    return { ok: false, error: "Select the state you're registered in" };
  }
  // Optional: an unregistered customer can still buy, they just can't claim
  // input tax credit.
  if (gstin && !GSTIN_RE.test(gstin)) {
    return { ok: false, error: "GSTIN must be 15 characters" };
  }

  return run(async () => {
    await saveCustomerProfile({
      legalName,
      gstin: gstin || null,
      billingAddress,
      stateCode,
      billingEmail: billingEmail || null,
    });
    revalidatePath("/settings/billing");
  });
}
