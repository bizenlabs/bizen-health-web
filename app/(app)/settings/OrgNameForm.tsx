"use client";

import { useState, useTransition } from "react";
import { updateOrgNameAction } from "./actions";

export function OrgNameForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const trimmed = name.trim();
  const dirty = trimmed.length > 0 && trimmed !== savedName;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await updateOrgNameAction(trimmed);
        setSavedName(trimmed);
        setName(trimmed);
        setSuccess("Workspace name updated");
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Failed to update workspace name",
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 flex flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1">
        <label htmlFor="org-name" className="block text-xs text-zinc-500">
          Workspace name
        </label>
        <input
          id="org-name"
          type="text"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
        />
      </div>
      <button
        type="submit"
        disabled={pending || !dirty}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Saving…" : "Save"}
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
