"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { statusLabel } from "@/lib/billing-status";
import type { BillingSubscription } from "@/lib/billing";
import { cancelSubscriptionAction } from "../actions";

const BADGE_COLOR = {
  TRIALING: "blue",
  ACTIVE: "green",
  PAST_DUE: "amber",
  READ_ONLY: "red",
  CANCELLED: "zinc",
} as const;

/** Core's status enum is upper snake; the shared copy helpers use lower. */
function toLowerStatus(status: BillingSubscription["status"]) {
  return status.toLowerCase() as Lowercase<BillingSubscription["status"]>;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

export function SubscriptionSummary({
  subscription,
}: {
  subscription: BillingSubscription;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const deadline = formatDate(subscription.deadline);
  const periodEnd = formatDate(subscription.currentPeriodEnd);
  const canCancel =
    !subscription.cancelAtPeriodEnd &&
    (subscription.status === "ACTIVE" || subscription.status === "PAST_DUE");

  function onCancel() {
    setError(null);
    startTransition(async () => {
      const result = await cancelSubscriptionAction();
      if (!result.ok) setError(result.error);
      else setConfirming(false);
    });
  }

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-3">
        <Badge color={BADGE_COLOR[subscription.status]}>
          {statusLabel(toLowerStatus(subscription.status))}
        </Badge>
        {subscription.planName ? (
          <span className="text-sm font-medium">{subscription.planName}</span>
        ) : (
          <span className="text-sm text-zinc-500">No plan selected</span>
        )}
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {subscription.status === "TRIALING" && deadline ? (
          <>
            <dt className="text-zinc-500">Trial ends</dt>
            <dd>{deadline}</dd>
          </>
        ) : null}

        {subscription.status === "PAST_DUE" && deadline ? (
          <>
            <dt className="text-zinc-500">Read-only from</dt>
            <dd>{deadline}</dd>
          </>
        ) : null}

        {subscription.status === "ACTIVE" && periodEnd ? (
          <>
            <dt className="text-zinc-500">
              {subscription.cancelAtPeriodEnd ? "Access until" : "Renews"}
            </dt>
            <dd>{periodEnd}</dd>
          </>
        ) : null}

        {subscription.pendingPlanCode ? (
          <>
            <dt className="text-zinc-500">Scheduled change</dt>
            <dd>
              Moving to {subscription.pendingPlanCode}
              {periodEnd ? ` on ${periodEnd}` : " at the end of this cycle"}
            </dd>
          </>
        ) : null}
      </dl>

      {/* Reassurance, not fine print: losing write access is not losing records. */}
      {!subscription.writable ? (
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          Your workspace is read-only. Everything is still here — you can view
          and export all of your records.
        </p>
      ) : null}

      {canCancel ? (
        <div className="mt-4">
          {confirming ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm">
                Cancel at the end of the current period? You keep access until
                {periodEnd ? ` ${periodEnd}` : " then"}, and your data is
                retained afterwards.
              </span>
              <Button color="red" disabled={pending} onClick={onCancel}>
                {pending ? "Cancelling…" : "Yes, cancel"}
              </Button>
              <Button
                plain
                disabled={pending}
                onClick={() => setConfirming(false)}
              >
                Keep plan
              </Button>
            </div>
          ) : (
            <Button plain onClick={() => setConfirming(true)}>
              Cancel subscription
            </Button>
          )}
        </div>
      ) : null}

      {subscription.cancelAtPeriodEnd ? (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
          Your subscription is set to end
          {periodEnd ? ` on ${periodEnd}` : " at the end of this period"}. Pick
          a plan below to stay subscribed.
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
