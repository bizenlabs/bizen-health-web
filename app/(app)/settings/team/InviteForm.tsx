"use client";

import { useState, useTransition } from "react";
import { inviteMemberAction } from "./actions";
import { ROLES } from "./roles";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("clinician");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const invitee = email;
    startTransition(async () => {
      const result = await inviteMemberAction(invitee, role);
      if (result.ok) {
        setSuccess(`Invitation sent to ${invitee}`);
        setEmail("");
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1">
        <label htmlFor="invite-email" className="block text-xs text-zinc-500">
          Email
        </label>
        <input
          id="invite-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
        />
      </div>
      <div>
        <label htmlFor="invite-role" className="block text-xs text-zinc-500">
          Role
        </label>
        <select
          id="invite-role"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="mt-1 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
        >
          {ROLES.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Sending…" : "Send invitation"}
      </button>
      {error ? (
        <p className="w-full text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {success ? (
        <p className="w-full text-sm text-emerald-600 dark:text-emerald-400">
          {success}
        </p>
      ) : null}
    </form>
  );
}
