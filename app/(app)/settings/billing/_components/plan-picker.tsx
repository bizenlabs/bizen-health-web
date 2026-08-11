"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { formatAmount } from "@/lib/billing-status";
import type { BillingPlan } from "@/lib/billing";
import { changePlanAction, startCheckoutAction } from "../actions";

export function PlanPicker({
  plans,
  currentPlanCode,
  pendingPlanCode,
  hasProfile,
  className,
}: {
  plans: BillingPlan[];
  currentPlanCode: string | null;
  pendingPlanCode: string | null;
  hasProfile: boolean;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(plan: BillingPlan) {
    setError(null);
    setBusyCode(plan.code);
    startTransition(async () => {
      // Both actions redirect to Razorpay's hosted page on success, so control
      // only returns here when something went wrong.
      const result = currentPlanCode
        ? await changePlanAction(plan.code)
        : await startCheckoutAction(plan.code);
      if (!result.ok) setError(result.error);
      setBusyCode(null);
    });
  }

  if (plans.length === 0) {
    return (
      <p className={clsx(className, "text-sm text-zinc-500")}>
        No plans are available yet.
      </p>
    );
  }

  return (
    <div className={className}>
      {!hasProfile ? (
        <p className="mb-4 text-sm text-amber-700 dark:text-amber-400">
          Add your billing details below before subscribing — we need them to
          issue a valid tax invoice.
        </p>
      ) : null}

      <ul className="grid gap-4 sm:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = plan.code === currentPlanCode;
          const isPending = plan.code === pendingPlanCode;
          const disabled =
            pending || isCurrent || !plan.purchasable || !hasProfile;

          return (
            <li
              key={plan.code}
              className={clsx(
                "rounded-lg border p-4",
                isCurrent
                  ? "border-blue-500 dark:border-blue-400"
                  : "border-zinc-200 dark:border-zinc-800",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{plan.name}</span>
                {isCurrent ? <Badge color="blue">Current</Badge> : null}
                {isPending ? <Badge color="amber">Scheduled</Badge> : null}
              </div>

              <p className="mt-2 text-2xl font-semibold">
                {formatAmount(plan.amountMinor, plan.currency)}
                <span className="ml-1 text-sm font-normal text-zinc-500">
                  /{plan.billingPeriod === "YEARLY" ? "year" : "month"}
                </span>
              </p>

              {plan.description ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {plan.description}
                </p>
              ) : null}

              <p className="mt-2 text-sm text-zinc-500">
                {plan.maxStaff === null
                  ? "Unlimited staff"
                  : `Up to ${plan.maxStaff} staff ${plan.maxStaff === 1 ? "member" : "members"}`}
              </p>

              <div className="mt-4">
                <Button
                  disabled={disabled}
                  onClick={() => choose(plan)}
                  className="w-full"
                >
                  {busyCode === plan.code
                    ? "Redirecting…"
                    : isCurrent
                      ? "Current plan"
                      : currentPlanCode
                        ? "Switch to this plan"
                        : "Choose plan"}
                </Button>
              </div>

              {/* The tier exists in the catalogue but has no payment plan bound
                  to it yet — the state every tier is in before go-live. */}
              {!plan.purchasable ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Not available for purchase yet.
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      {currentPlanCode ? (
        <p className="mt-4 text-sm text-zinc-500">
          Switching plans takes effect at the end of your current cycle, and
          requires re-authorising your payment method.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
