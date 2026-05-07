"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { switchOrgAction } from "@/app/select-org/actions";

type Membership = {
  organizationId: string;
  organizationName: string;
  status: "active" | "inactive" | "pending";
};

function SwitchButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-900"
    >
      <span>{name}</span>
      {pending ? <span className="text-xs text-zinc-500">…</span> : null}
    </button>
  );
}

export function OrgSwitcher({
  currentOrgId,
  currentOrgSlug,
  memberships,
}: {
  currentOrgId: string;
  currentOrgSlug: string | null;
  memberships: Membership[];
}) {
  const [open, setOpen] = useState(false);
  const current = memberships.find((m) => m.organizationId === currentOrgId);
  const others = memberships.filter(
    (m) => m.organizationId !== currentOrgId && m.status === "active",
  );

  const label = current?.organizationName ?? currentOrgSlug ?? currentOrgId;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {label}
        {others.length > 0 ? (
          <span className="ml-2 text-xs text-zinc-500">▾</span>
        ) : null}
      </button>
      {open && others.length > 0 ? (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-md dark:border-zinc-800 dark:bg-zinc-950"
        >
          {others.map((m) => (
            <form
              key={m.organizationId}
              action={switchOrgAction.bind(
                null,
                m.organizationId,
                "/dashboard",
              )}
            >
              <SwitchButton name={m.organizationName} />
            </form>
          ))}
        </div>
      ) : null}
    </div>
  );
}
