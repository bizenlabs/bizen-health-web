"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilSquareIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { Input } from "@/components/catalyst/input";
import { renameTranscriptionAction } from "@/app/(app)/transcription-actions";

// The dictation's name, shown as the page heading and editable in place. A
// dictation has no name until the user gives it one; until then it shows a
// derived fallback label (template name, or "Free-form dictation"), and
// clearing the field returns to that fallback. Renames persist via a server
// action; router.refresh() re-renders the page (and the library on the way
// back) with the new name.

export function DictationTitle({
  transcriptionId,
  title,
  fallbackLabel,
  editable,
}: {
  transcriptionId: string;
  title: string | null;
  fallbackLabel: string;
  editable: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open() {
    setDraft(title ?? "");
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setDraft(title ?? "");
    setError(null);
    setEditing(false);
  }

  function save() {
    const next = draft.trim();
    if (next === (title ?? "")) {
      cancel();
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await renameTranscriptionAction(
        transcriptionId,
        next || null,
      );
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (editing) {
    return (
      <div className="mt-3">
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            else if (e.key === "Escape") cancel();
          }}
          onBlur={save}
          disabled={pending}
          maxLength={255}
          placeholder={fallbackLabel}
          aria-label="Dictation name"
          className="max-w-md"
        />
        {error ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </div>
    );
  }

  const display = title ?? fallbackLabel;

  if (!editable) {
    return (
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
        {display}
      </h1>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      aria-label="Rename dictation"
      className="group mt-3 flex items-center gap-2 text-left"
    >
      <span
        className={clsx(
          "text-2xl font-semibold tracking-tight",
          title
            ? "text-zinc-900 dark:text-white"
            : "text-zinc-400 dark:text-zinc-500",
        )}
      >
        {display}
      </span>
      <PencilSquareIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400"
      />
    </button>
  );
}
