"use client";

import { useEffect, useRef, useState } from "react";
import { editTranscriptionNoteAction } from "@/app/(app)/transcription-actions";

type SaveStatus = "idle" | "saving" | "saved" | "error";

// Editable dictation note. Seeded from the raw transcript when no note has
// been curated yet; debounced auto-save through the transcription server
// action. The note is stored as Markdown (template-ready — see the Templates
// follow-on).
export function DictationNoteEditor({
  transcriptionId,
  initialNote,
  transcriptText,
}: {
  transcriptionId: string;
  initialNote: string | null;
  transcriptText: string;
}) {
  const [value, setValue] = useState(initialNote ?? transcriptText);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function onChange(next: string) {
    setValue(next);
    setStatus("saving");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void (async () => {
        const res = await editTranscriptionNoteAction(
          transcriptionId,
          next,
          null,
        );
        setStatus(res.ok ? "saved" : "error");
      })();
    }, 1500);
  }

  return (
    <div className="mt-3">
      <textarea
        rows={14}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Dictated note…"
        className="w-full rounded-md border border-zinc-200 px-3 py-2 font-mono text-sm dark:border-zinc-800 dark:bg-transparent"
      />
      <p className="mt-1 text-xs text-zinc-500">{statusLabel(status)}</p>
    </div>
  );
}

function statusLabel(status: SaveStatus): string {
  switch (status) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error":
      return "Could not save — retry by editing again.";
    default:
      return "Edits auto-save. Markdown is supported.";
  }
}
