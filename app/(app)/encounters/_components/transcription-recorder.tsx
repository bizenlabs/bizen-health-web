"use client";

import { useRouter } from "next/navigation";
import { useTranscription } from "@/lib/transcription/use-transcription";

// Live encounter-transcription recorder. Streams microphone audio straight to
// Deepgram (audio never touches our servers); finalised utterances are saved
// through the transcription server actions inside the hook.
export function TranscriptionRecorder({
  encounterId,
}: {
  encounterId: string;
}) {
  const router = useRouter();
  const { state, error, segments, partial, start, pause, resume, stop } =
    useTranscription();

  const recording = state === "recording";
  const paused = state === "paused";
  const live = recording || paused;
  const busy = state === "starting" || state === "stopping";

  async function handleStart() {
    await start({ mode: "ENCOUNTER", encounterId });
  }

  async function handleStop() {
    const result = await stop();
    // Refresh so the panel's server-rendered transcript list picks up the
    // newly completed session.
    if (result) router.refresh();
  }

  const heading =
    state === "starting"
      ? "Starting…"
      : state === "stopping"
        ? "Saving…"
        : paused
          ? "Paused"
          : recording
            ? "Recording…"
            : "New transcription";

  return (
    <div className="rounded-md border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {paused ? (
            <span className="h-2 w-2 rounded-full bg-amber-500" />
          ) : recording ? (
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          ) : null}
          <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            {heading}
          </h3>
        </div>
        {live ? (
          <div className="flex items-center gap-2">
            {paused ? (
              <button
                type="button"
                onClick={resume}
                className="rounded-md border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              >
                Resume
              </button>
            ) : (
              <button
                type="button"
                onClick={pause}
                disabled={busy}
                className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Pause
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleStop()}
              disabled={busy}
              className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Stop &amp; save
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void handleStart()}
            disabled={busy}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            {busy ? "…" : "Start recording"}
          </button>
        )}
      </div>

      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {segments.length > 0 || partial ? (
        <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          {segments.map((s) => (
            <p key={s.sequence}>
              {s.speakerIndex != null ? (
                <SpeakerChip index={s.speakerIndex} />
              ) : null}
              {s.text}
            </p>
          ))}
          {partial ? (
            <p className="text-zinc-400 dark:text-zinc-500">
              {partial.speakerIndex != null ? (
                <SpeakerChip index={partial.speakerIndex} />
              ) : null}
              {partial.text}
            </p>
          ) : null}
        </div>
      ) : null}

      {!live && !busy && segments.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-500">
          Streams audio to Deepgram and transcribes the consultation. The audio
          itself is never stored — only the transcript.
        </p>
      ) : null}
    </div>
  );
}

function SpeakerChip({ index }: { index: number }) {
  return (
    <span className="mr-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
      Speaker {index + 1}
    </span>
  );
}
