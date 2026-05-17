"use client";

import { useRouter } from "next/navigation";
import { useTranscription } from "@/lib/transcription/use-transcription";

// Standalone dictation recorder. Single-speaker (no diarization); on stop it
// navigates to the dictation's detail page so the clinician can curate the
// note.
export function DictationRecorder() {
  const router = useRouter();
  const { state, error, segments, partial, start, stop } = useTranscription();

  const recording = state === "recording";
  const busy = state === "starting" || state === "stopping";
  const liveText = segments.map((s) => s.text).join(" ");

  async function handleStop() {
    const result = await stop();
    if (result) router.push(`/dictation/${result.id}`);
  }

  const heading =
    state === "starting"
      ? "Starting…"
      : state === "stopping"
        ? "Saving…"
        : recording
          ? "Listening…"
          : "New dictation";

  return (
    <div className="rounded-md border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {recording ? (
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          ) : null}
          <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            {heading}
          </h3>
        </div>
        {recording ? (
          <button
            type="button"
            onClick={() => void handleStop()}
            disabled={busy}
            className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Stop &amp; save
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start({ mode: "DICTATION" })}
            disabled={busy}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            {busy ? "…" : "Start dictation"}
          </button>
        )}
      </div>

      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {liveText || partial ? (
        <div className="mt-3 max-h-72 overflow-y-auto rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <span>{liveText}</span>{" "}
          {partial ? (
            <span className="text-zinc-400 dark:text-zinc-500">
              {partial.text}
            </span>
          ) : null}
        </div>
      ) : null}

      {!recording && !busy && segments.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">
          Dictate a clinical note. Audio streams to Deepgram and is never stored
          — only the transcript.
        </p>
      ) : null}
    </div>
  );
}
