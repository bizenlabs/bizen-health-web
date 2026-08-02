"use server";

import { ApiError, ForbiddenError, UnauthorizedError } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { listDictionary } from "@/lib/dictionary";
import type { DictionaryReplacement } from "@/lib/transcription/dictionary-replace";

// Read-only action for the live transcription surfaces — the dictation editor
// and encounter recorders call this from the browser to load the active
// dictionary (recognition key terms + written-form replacements). Writes live in
// the settings page actions; this is deliberately the only client-callable read.

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * The active dictionary as spoken/written pairs. Best-effort: an API error
 * resolves to a failure result so the caller degrades to no dictionary rather
 * than breaking recording. Auth failures still propagate to the framework.
 */
export async function loadDictionaryAction(): Promise<
  ActionResult<DictionaryReplacement[]>
> {
  try {
    await requireSession();
    const entries = await listDictionary(false);
    return {
      ok: true,
      data: entries.map((e) => ({
        spokenForm: e.spokenForm,
        writtenForm: e.writtenForm,
      })),
    };
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
      throw err;
    }
    if (err instanceof ApiError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}
