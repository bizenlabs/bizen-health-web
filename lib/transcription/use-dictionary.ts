"use client";

import { useEffect, useMemo, useState } from "react";
import { loadDictionaryAction } from "@/app/(app)/dictionary-actions";
import type { DictionaryReplacement } from "./dictionary-replace";

// Loads the active custom dictionary for the live transcription surfaces. The
// recorders feed `keyterms` to Deepgram (recognition) and the dictation editor
// uses `entries` for the written-form replacement pass. Best-effort: a failed
// load leaves both empty, so recording still works without the dictionary.

export interface DictionaryData {
  /** spoken/written pairs — drives the replacement pass (editor only). */
  entries: DictionaryReplacement[];
  /** Spoken forms — sent to Deepgram as key terms for better recognition. */
  keyterms: string[];
}

export function useDictionary(): DictionaryData {
  const [entries, setEntries] = useState<DictionaryReplacement[]>([]);

  useEffect(() => {
    let active = true;
    loadDictionaryAction()
      .then((res) => {
        if (active && res.ok) setEntries(res.data);
      })
      .catch(() => {
        /* best effort — degrade to no dictionary */
      });
    return () => {
      active = false;
    };
  }, []);

  const keyterms = useMemo(
    () => entries.map((e) => e.spokenForm).filter((s) => s.trim().length > 0),
    [entries],
  );

  return { entries, keyterms };
}
