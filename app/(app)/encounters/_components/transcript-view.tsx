"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  labelSpeakerAction,
  voidTranscriptionAction,
} from "@/app/(app)/transcription-actions";
import type {
  TranscriptionDetail,
  TranscriptionStatus,
} from "@/lib/transcriptions";

// Renders one saved transcription: its segments, an inline speaker-relabel
// editor, and a delete (void) control.
export function TranscriptView({
  transcription,
}: {
  transcription: TranscriptionDetail;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    for (const sp of transcription.speakers)
      initial[sp.speakerIndex] = sp.label;
    return initial;
  });

  const indexes = speakerIndexes(transcription);

  function displayLabel(index: number): string {
    return labels[index]?.trim() || `Speaker ${index + 1}`;
  }

  function saveLabel(index: number) {
    const label = labels[index]?.trim();
    if (!label) return;
    setError(null);
    startTransition(async () => {
      const res = await labelSpeakerAction(transcription.id, index, label);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  function remove() {
    if (!confirm("Delete this transcription?")) return;
    setError(null);
    startTransition(async () => {
      const res = await voidTranscriptionAction(transcription.id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <div className="mt-3 rounded-md border border-zinc-200 dark:border-zinc-800">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <StatusBadge status={transcription.status} />
          <span>{new Date(transcription.startedAt).toLocaleString()}</span>
          <span>·</span>
          <span>{transcription.segments.length} segments</span>
        </div>
        <button
          type="button"
          onClick={remove}
          disabled={pending}
          className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          Delete
        </button>
      </div>

      {indexes.length > 0 ? (
        <div className="flex flex-wrap gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          {indexes.map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-400">S{i + 1}</span>
              <input
                type="text"
                value={labels[i] ?? ""}
                placeholder={`Speaker ${i + 1}`}
                onChange={(e) =>
                  setLabels((prev) => ({ ...prev, [i]: e.target.value }))
                }
                className="w-36 rounded-md border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-800 dark:bg-transparent"
              />
              <button
                type="button"
                onClick={() => saveLabel(i)}
                disabled={pending}
                className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Save
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="px-4 pt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      <div className="max-h-96 space-y-1.5 overflow-y-auto px-4 py-3 text-sm">
        {transcription.segments.length === 0 ? (
          <p className="text-zinc-500">No transcript captured.</p>
        ) : (
          transcription.segments.map((s) => (
            <p key={s.id}>
              {s.speakerIndex != null ? (
                <span className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {displayLabel(s.speakerIndex)}
                </span>
              ) : null}
              {s.text}
            </p>
          ))
        )}
      </div>

      {transcription.noteContent ? (
        <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <div className="text-xs tracking-wide text-zinc-500 uppercase">
            Note
          </div>
          <pre className="mt-1 font-sans text-sm whitespace-pre-wrap">
            {transcription.noteContent}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function speakerIndexes(t: TranscriptionDetail): number[] {
  const seen = new Set<number>();
  for (const s of t.segments)
    if (s.speakerIndex != null) seen.add(s.speakerIndex);
  for (const sp of t.speakers) seen.add(sp.speakerIndex);
  return [...seen].sort((a, b) => a - b);
}

function StatusBadge({ status }: { status: TranscriptionStatus }) {
  const tone =
    status === "COMPLETED"
      ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300"
      : status === "FAILED"
        ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
        : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone}`}>
      {status === "IN_PROGRESS" ? "In progress" : status.toLowerCase()}
    </span>
  );
}
