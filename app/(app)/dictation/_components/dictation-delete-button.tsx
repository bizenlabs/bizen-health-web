"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUturnLeftIcon, TrashIcon } from "@heroicons/react/20/solid";
import {
  restoreTranscriptionAction,
  voidTranscriptionAction,
} from "@/app/(app)/transcription-actions";

// Delete / restore control for a single dictation. A dictation is never hard-
// deleted — "delete" voids it (the BFF DELETE is a soft-void), so a voided
// dictation can be restored. The actions return a result rather than throwing;
// on success we refresh so the server component re-renders in the new state.

export function DictationDeleteButton({
  transcriptionId,
  voided,
}: {
  transcriptionId: string;
  voided: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (
      !confirm(
        "Delete this dictation? It will be hidden from your library, but can be restored.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await voidTranscriptionAction(transcriptionId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function handleRestore() {
    setError(null);
    startTransition(async () => {
      const res = await restoreTranscriptionAction(transcriptionId);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      {voided ? (
        <button
          type="button"
          onClick={handleRestore}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <ArrowUturnLeftIcon aria-hidden="true" className="size-4" />
          {pending ? "Restoring…" : "Restore"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3.5 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          <TrashIcon aria-hidden="true" className="size-4" />
          {pending ? "Deleting…" : "Delete"}
        </button>
      )}
      {error ? (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      ) : null}
    </div>
  );
}
