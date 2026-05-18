"use client";

import { useRouter } from "next/navigation";
import {
  DocumentTextIcon,
  MicrophoneIcon,
  PencilSquareIcon,
} from "@heroicons/react/20/solid";
import { useTranscription } from "@/lib/transcription/use-transcription";

// Standalone dictation recorder. Single-speaker (no diarization). The clinician
// reaches it from the dictation intake step, which hands down the chosen note
// template and microphone; on stop it navigates to the dictation's detail page
// so the clinician can curate the note.
export function DictationRecorder({
  templateId,
  templateName,
  deviceId,
  onChangeSetup,
}: {
  templateId: string | null;
  templateName: string | null;
  deviceId: string | null;
  onChangeSetup: () => void;
}) {
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
          : "Ready to dictate";

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
            onClick={() =>
              void start({ mode: "DICTATION", templateId }, { deviceId })
            }
            disabled={busy}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            {busy ? "…" : "Start dictation"}
          </button>
        )}
      </div>

      {/* Chosen setup — shown until recording starts, with a way back to intake. */}
      {!recording && !busy ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 font-medium dark:bg-zinc-800">
            {templateName ? (
              <DocumentTextIcon className="size-3.5" />
            ) : (
              <PencilSquareIcon className="size-3.5" />
            )}
            {templateName ?? "Free-form"}
          </span>
          <button
            type="button"
            onClick={onChangeSetup}
            className="text-zinc-500 underline-offset-2 hover:underline"
          >
            Change
          </button>
        </div>
      ) : null}

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
        <p className="mt-3 flex items-start gap-1.5 text-xs text-zinc-500">
          <MicrophoneIcon className="mt-0.5 size-3.5 shrink-0" />
          Audio is not stored — only the transcript.
        </p>
      ) : null}
    </div>
  );
}
