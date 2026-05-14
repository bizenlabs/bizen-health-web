"use client";

import { useState, useTransition } from "react";
import { OrgSwitchingOverlay } from "@/components/shell/OrgSwitchingOverlay";
import { switchOrgAction } from "./actions";

type Membership = {
  organizationId: string;
  organizationName: string;
  role: { slug: string } | null;
};

export function SelectOrgList({
  memberships,
  returnTo,
}: {
  memberships: Membership[];
  returnTo: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingOrgName, setPendingOrgName] = useState<string | null>(null);

  function handleSwitch(organizationId: string, organizationName: string) {
    setPendingOrgName(organizationName);
    startTransition(async () => {
      await switchOrgAction(organizationId, returnTo);
    });
  }

  return (
    <>
      <OrgSwitchingOverlay orgName={isPending ? pendingOrgName : null} />
      <ul className="mt-8 space-y-2">
        {memberships.map((m) => (
          <li key={m.organizationId}>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleSwitch(m.organizationId, m.organizationName)}
              className="flex w-full items-center justify-between rounded-md border border-zinc-200 px-4 py-3 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <span className="font-medium">{m.organizationName}</span>
              <span className="text-xs text-zinc-500">
                {m.role?.slug ?? ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
