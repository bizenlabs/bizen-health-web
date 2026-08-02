"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUturnLeftIcon, TrashIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import {
  Alert,
  AlertActions,
  AlertDescription,
  AlertTitle,
} from "@/components/catalyst/alert";
import { Button } from "@/components/catalyst/button";
import {
  restoreTranscriptionAction,
  voidTranscriptionAction,
} from "@/app/(app)/transcription-actions";

// Compact inline delete / restore for a dictation library row. Mirrors the
// detail page's DictationDeleteButton — "delete" is a soft-void, so a voided
// row offers restore instead. router.refresh() re-pulls the list afterwards.

export function DictationRowDelete({
  transcriptionId,
  voided,
  label,
}: {
  transcriptionId: string;
  voided: boolean;
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  function confirmDelete() {
    setFailed(false);
    startTransition(async () => {
      const res = await voidTranscriptionAction(transcriptionId);
      setConfirming(false);
      if (res.ok) router.refresh();
      else setFailed(true);
    });
  }

  function handleRestore() {
    setFailed(false);
    startTransition(async () => {
      const res = await restoreTranscriptionAction(transcriptionId);
      if (res.ok) router.refresh();
      else setFailed(true);
    });
  }

  const Icon = voided ? ArrowUturnLeftIcon : TrashIcon;
  return (
    <>
      <button
        type="button"
        onClick={voided ? handleRestore : () => setConfirming(true)}
        disabled={pending}
        aria-label={voided ? `Restore ${label}` : `Delete ${label}`}
        title={
          failed ? "Action failed — try again" : voided ? "Restore" : "Delete"
        }
        className={clsx(
          "flex size-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-40",
          voided
            ? "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700"
            : "text-zinc-300 hover:bg-red-50 hover:text-red-600 dark:text-zinc-600 dark:hover:bg-red-950/40 dark:hover:text-red-400",
          failed && "text-red-500 dark:text-red-400",
        )}
      >
        <Icon aria-hidden="true" className="size-4" />
      </button>

      <Alert open={confirming} onClose={() => setConfirming(false)} size="sm">
        <AlertTitle>Delete this dictation?</AlertTitle>
        <AlertDescription>
          “{label}” will be removed from your library.
        </AlertDescription>
        <AlertActions>
          <Button plain onClick={() => setConfirming(false)} disabled={pending}>
            Cancel
          </Button>
          <Button color="red" onClick={confirmDelete} disabled={pending}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </AlertActions>
      </Alert>
    </>
  );
}
