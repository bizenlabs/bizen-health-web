"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/catalyst/button";
import { Field, Label } from "@/components/catalyst/fieldset";
import { Input } from "@/components/catalyst/input";
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
    <form onSubmit={onSubmit} className="max-w-md">
      <Field>
        <Label>Workspace name</Label>
        <Input
          name="org-name"
          type="text"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        {success ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {success}
          </p>
        ) : null}
      </div>
    </form>
  );
}
