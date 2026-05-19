"use server";

import { revalidatePath } from "next/cache";
import { ApiError, ForbiddenError, UnauthorizedError } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import {
  appendSegments,
  completeTranscription,
  type DeepgramKey,
  editTranscriptionNote,
  failTranscription,
  labelSpeaker,
  mintDeepgramKey,
  reopenTranscription,
  type SegmentInput,
  startTranscription,
  type StartTranscriptionInput,
  type TranscriptionDetail,
  voidTranscription,
  restoreTranscription,
} from "@/lib/transcriptions";

// Shared server actions for medical transcription & dictation. Imported by
// both the encounter recorder and the standalone dictation page — kept here
// (rather than feature-local) because the two surfaces drive the same
// session lifecycle. The browser hook calls these imperatively, so they
// return a discriminated result rather than throwing across the RSC boundary.

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Runs a BFF call, mapping expected ApiErrors (validation/conflict/not-found)
// to a result. Auth failures propagate so the framework can redirect.
async function run<T>(
  fn: () => Promise<T>,
  fallback: string,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
      throw err;
    }
    if (err instanceof ApiError) {
      return { ok: false, error: err.message || fallback };
    }
    throw err;
  }
}

// Revalidates whatever server-rendered views a transcription change touches:
// its encounter page (if linked) and the dictation list.
function revalidateFor(t: TranscriptionDetail): void {
  if (t.encounterId) revalidatePath(`/encounters/${t.encounterId}`);
  revalidatePath("/dictation");
  revalidatePath(`/dictation/${t.id}`);
}

export async function startTranscriptionAction(
  input: StartTranscriptionInput,
): Promise<ActionResult<TranscriptionDetail>> {
  await requireSession();
  return run(
    () => startTranscription(input),
    "Failed to start the transcription session.",
  );
}

export async function mintDeepgramKeyAction(
  transcriptionId: string,
): Promise<ActionResult<DeepgramKey>> {
  await requireSession();
  return run(
    () => mintDeepgramKey(transcriptionId),
    "Failed to obtain a transcription key.",
  );
}

export async function appendSegmentsAction(
  transcriptionId: string,
  segments: SegmentInput[],
): Promise<ActionResult<void>> {
  await requireSession();
  if (segments.length === 0) return { ok: true, data: undefined };
  return run(async () => {
    await appendSegments(transcriptionId, segments);
  }, "Failed to save transcript segments.");
}

export async function completeTranscriptionAction(
  transcriptionId: string,
  opts: { endedAt?: string | null; deepgramRequestId?: string | null } = {},
): Promise<ActionResult<TranscriptionDetail>> {
  await requireSession();
  const result = await run(
    () => completeTranscription(transcriptionId, opts),
    "Failed to finalise the transcription.",
  );
  if (result.ok) revalidateFor(result.data);
  return result;
}

export async function failTranscriptionAction(
  transcriptionId: string,
  reason?: string,
): Promise<ActionResult<void>> {
  await requireSession();
  const result = await run(
    () => failTranscription(transcriptionId, reason),
    "Failed to abort the transcription.",
  );
  if (result.ok) revalidateFor(result.data);
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function editTranscriptionNoteAction(
  transcriptionId: string,
  noteContent: string | null,
  templateId: string | null = null,
): Promise<ActionResult<TranscriptionDetail>> {
  await requireSession();
  const result = await run(
    () => editTranscriptionNote(transcriptionId, { noteContent, templateId }),
    "Failed to save the note.",
  );
  if (result.ok) revalidateFor(result.data);
  return result;
}

export async function labelSpeakerAction(
  transcriptionId: string,
  speakerIndex: number,
  label: string,
): Promise<ActionResult<TranscriptionDetail>> {
  await requireSession();
  const result = await run(
    () => labelSpeaker(transcriptionId, speakerIndex, label),
    "Failed to relabel the speaker.",
  );
  if (result.ok) revalidateFor(result.data);
  return result;
}

export async function voidTranscriptionAction(
  transcriptionId: string,
  reason?: string,
): Promise<ActionResult<void>> {
  await requireSession();
  const result = await run(
    () => voidTranscription(transcriptionId, reason),
    "Failed to delete the transcription.",
  );
  if (result.ok) revalidateFor(result.data);
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function restoreTranscriptionAction(
  transcriptionId: string,
): Promise<ActionResult<void>> {
  await requireSession();
  const result = await run(
    () => restoreTranscription(transcriptionId),
    "Failed to restore the transcription.",
  );
  if (result.ok) revalidateFor(result.data);
  return result.ok ? { ok: true, data: undefined } : result;
}

export async function reopenTranscriptionAction(
  transcriptionId: string,
): Promise<ActionResult<TranscriptionDetail>> {
  await requireSession();
  const result = await run(
    () => reopenTranscription(transcriptionId),
    "Failed to resume the dictation.",
  );
  if (result.ok) revalidateFor(result.data);
  return result;
}
