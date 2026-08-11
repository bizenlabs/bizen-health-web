import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getSubscription } from "@/lib/billing";

/**
 * Where Razorpay's hosted page sends the customer back to.
 *
 * Deliberately does not treat arriving here as proof of payment — the redirect
 * is attacker-controllable and, more mundanely, a UPI mandate can take a moment
 * to confirm. The webhook is what actually moves our state; this page just
 * reads whatever core currently believes.
 *
 * Rendered fresh on each visit (`lib/api.ts` is `no-store`), so a manual
 * refresh is the retry.
 */
export default async function BillingReturnPage() {
  await requireRole("tenant_admin", "super_admin");
  const subscription = await getSubscription();

  const confirmed =
    subscription.status === "ACTIVE" && !subscription.cancelAtPeriodEnd;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-semibold">
        {confirmed ? "You're all set" : "Confirming your payment"}
      </h1>

      {confirmed ? (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Your {subscription.planName ?? "subscription"} is active. Thank you.
        </p>
      ) : (
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Your bank is still confirming the mandate. This usually takes a few
          moments, but some methods can take longer — you can safely leave this
          page and carry on working. We&apos;ll update your workspace as soon as
          the payment clears.
        </p>
      )}

      <div className="mt-6 flex gap-4 text-sm">
        <Link href="/settings/billing" className="font-semibold underline">
          Back to billing
        </Link>
        <Link href="/dashboard" className="underline">
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
