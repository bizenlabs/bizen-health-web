"use client";

import { useEffect, useRef, useState } from "react";
import { useTranscription } from "@/lib/transcription/use-transcription";

// The encounter Notes field with a built-in "Dictate" control. Dictated text
// is appended into the textarea live; the field keeps the name="notes" so the
// surrounding encounter form submits it unchanged. Dictation also persists a
// DICTATION transcription record (linked to the encounter when one exists) for
// the audit trail.
export function DictatableNotesField({
  encounterId,
  defaultValue,
}: {
  encounterId: string | null;
  defaultValue: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const { state, error, segments, partial, start, pause, resume, stop } =
    useTranscription();
  const appendedRef = useRef(0);

  const recording = state === "recording";
  const paused = state === "paused";
  const live = recording || paused;
  const busy = state === "starting" || state === "stopping";

  // Append each newly finalised segment into the textarea.
  useEffect(() => {
    if (segments.length > appendedRef.current) {
      const fresh = segments
        .slice(appendedRef.current)
        .map((s) => s.text)
        .join(" ");
      appendedRef.current = segments.length;
      setValue((v) => (v.trim() ? `${v.trimEnd()} ${fresh}` : fresh));
    }
  }, [segments]);

  async function handleStart() {
    appendedRef.current = 0;
    await start({ mode: "DICTATION", encounterId });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="notes" className="block text-xs text-zinc-500">
          Notes
        </label>
        <div className="flex items-center gap-1.5">
          {live ? (
            <button
              type="button"
              onClick={paused ? resume : pause}
              disabled={busy}
              className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              {paused ? "Resume" : "Pause"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void (live ? stop() : handleStart())}
            disabled={busy}
            className="rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            {live ? "Stop dictation" : busy ? "…" : "Dictate"}
          </button>
        </div>
      </div>
      <textarea
        id="notes"
        name="notes"
        rows={5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
      />
      {live ? (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
          <span
            className={
              paused
                ? "h-1.5 w-1.5 rounded-full bg-amber-500"
                : "h-1.5 w-1.5 animate-pulse rounded-full bg-red-500"
            }
          />
          {paused ? (
            "Paused — mic muted."
          ) : (
            <>
              Listening…{" "}
              {partial ? (
                <span className="text-zinc-400">{partial.text}</span>
              ) : (
                "spoken text is appended above."
              )}
            </>
          )}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
