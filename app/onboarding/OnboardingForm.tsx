"use client";

import { useState, useTransition } from "react";
import { createWorkspaceAction } from "./actions";

type OrgType = "individual" | "clinic";

export function OnboardingForm({
  individualDefault,
}: {
  individualDefault: string;
}) {
  const [orgType, setOrgType] = useState<OrgType>("individual");
  const [orgName, setOrgName] = useState<string>(individualDefault);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pickType(next: OrgType) {
    setOrgType(next);
    if (!touched) {
      setOrgName(next === "individual" ? individualDefault : "");
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const trimmed = orgName.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      setError("Workspace name must be 2–80 characters");
      return;
    }
    startTransition(async () => {
      try {
        await createWorkspaceAction(orgType, trimmed);
      } catch (err) {
        // switchToOrganization throws NEXT_REDIRECT on success; that's expected
        // and Next handles it. Only surface unexpected errors to the user.
        if (err instanceof Error && err.message) {
          setError(err.message);
        } else {
          setError("Something went wrong. Please try again.");
        }
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Account type</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
          <input
            type="radio"
            name="orgType"
            value="individual"
            checked={orgType === "individual"}
            onChange={() => pickType("individual")}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium">
              Individual practitioner
            </span>
            <span className="block text-xs text-zinc-500">
              Just you, for your own practice.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900">
          <input
            type="radio"
            name="orgType"
            value="clinic"
            checked={orgType === "clinic"}
            onChange={() => pickType("clinic")}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-medium">Clinic / Group</span>
            <span className="block text-xs text-zinc-500">
              You&apos;ll invite team members.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="orgName" className="block text-sm font-medium">
          Workspace name
        </label>
        <input
          id="orgName"
          type="text"
          value={orgName}
          onChange={(e) => {
            setOrgName(e.target.value);
            setTouched(true);
          }}
          placeholder={orgType === "clinic" ? "Acme Clinic" : "Dr. Jane Doe"}
          required
          minLength={2}
          maxLength={80}
          className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Creating workspace…" : "Create workspace"}
      </button>
    </form>
  );
}
