"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { bannerFor, type BannerSeverity } from "@/lib/billing-status";
import type { BillingStatus } from "@/lib/workos-metadata";

const SEVERITY_STYLES: Record<BannerSeverity, string> = {
  info: "bg-blue-50 text-blue-900 dark:bg-blue-950/40 dark:text-blue-100",
  warning:
    "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
  danger: "bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100",
};

/**
 * Tells a clinic when its billing needs attention.
 *
 * Reads state the session already carries — core mirrors it into WorkOS org
 * metadata, which the proxy fetches on every request anyway — so this costs no
 * extra round trip.
 *
 * Purely informational. Whether a write actually succeeds is decided by Spring,
 * which re-evaluates the same state independently on every request.
 */
export function BillingBanner({
  status,
  deadline,
  isAdmin,
}: {
  status: BillingStatus | null;
  deadline: string | null;
  isAdmin: boolean;
}) {
  const [dismissed, setDismissed] = useState(false);

  const banner = bannerFor(status, deadline, new Date());
  if (!banner || dismissed) return null;

  return (
    <div
      role="status"
      className={clsx(
        "flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3 text-sm",
        SEVERITY_STYLES[banner.severity],
      )}
    >
      <span className="flex-1">{banner.message}</span>

      {/* Only an admin can act on it; everyone else just needs to know why the
          workspace is behaving differently. */}
      {isAdmin ? (
        <Link href="/settings/billing" className="font-semibold underline">
          {banner.ctaLabel}
        </Link>
      ) : (
        <span className="text-xs opacity-80">
          Ask an admin at your clinic to update billing.
        </span>
      )}

      {banner.dismissible ? (
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-xs opacity-70 hover:opacity-100"
          aria-label="Dismiss"
        >
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
