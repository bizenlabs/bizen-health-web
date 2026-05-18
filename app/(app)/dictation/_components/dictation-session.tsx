"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startTranscriptionAction } from "@/app/(app)/transcription-actions";
import type { TemplateSummary } from "@/lib/templates";
import { DictationIntake, type DictationChoice } from "./dictation-intake";

// Bridges the intake step to the unified editor: once the clinician picks a
// template + microphone, this mints the transcription session (so there is an
// id to route to) and navigates to /dictation/[id]?record=1, where the editor
// begins recording. The chosen mic rides across in sessionStorage.
const DEVICE_KEY = "bizen:dictation:device";

export function DictationSession({
  templates,
}: {
  templates: TemplateSummary[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReady(choice: DictationChoice) {
    setCreating(true);
    setError(null);
    const res = await startTranscriptionAction({
      mode: "DICTATION",
      templateId: choice.templateId,
    });
    if (!res.ok) {
      setError(res.error);
      setCreating(false);
      return;
    }
    try {
      if (choice.deviceId) sessionStorage.setItem(DEVICE_KEY, choice.deviceId);
      else sessionStorage.removeItem(DEVICE_KEY);
    } catch {
      /* sessionStorage unavailable — the editor falls back to the default mic */
    }
    router.push(`/dictation/${res.data.id}?record=1`);
  }

  if (creating) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-2xl border border-zinc-200/80 bg-white px-6 py-16 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
        <span className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
        <span className="font-mono text-[11px] tracking-[0.15em] text-zinc-400 uppercase dark:text-zinc-500">
          Starting…
        </span>
      </div>
    );
  }

  return (
    <div>
      {error ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          Couldn’t start the dictation: {error}
        </p>
      ) : null}
      <DictationIntake templates={templates} onReady={handleReady} />
    </div>
  );
}
