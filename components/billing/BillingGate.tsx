"use client";

import { createContext, useContext, type ReactNode } from "react";
import { isWriteBlocked } from "@/lib/billing-status";
import type { BillingStatus } from "@/lib/workos-metadata";

/**
 * Client-side awareness of whether the workspace can be written to.
 *
 * UX only, exactly like `<Can>`. Spring is the boundary and answers this
 * independently on every request; this exists so a clinician sees a disabled
 * "New patient" button with a reason, instead of filling in a form and being
 * rejected on submit.
 *
 * Deliberately used on a handful of primary calls to action rather than wired
 * through every form. `lib/api.ts` already turns core's 402 into an inline
 * message everywhere, so the marginal value of disabling the twentieth button
 * is low and the risk of drifting out of sync with the real rule is not.
 */
const BillingGateContext = createContext<{ writable: boolean }>({
  writable: true,
});

export function BillingGateProvider({
  status,
  children,
}: {
  status: BillingStatus | null;
  children: ReactNode;
}) {
  return (
    <BillingGateContext value={{ writable: !isWriteBlocked(status) }}>
      {children}
    </BillingGateContext>
  );
}

/** True when writes are expected to succeed. Defaults open. */
export function useBillingWritable(): boolean {
  return useContext(BillingGateContext).writable;
}

/**
 * Explanatory text for a disabled control. Null when writes are fine, so it can
 * be spread straight into a `title`/`aria-description`.
 */
export function useBillingBlockedReason(): string | null {
  const writable = useBillingWritable();
  return writable
    ? null
    : "Your workspace is read-only. Reactivate your subscription to make changes.";
}
