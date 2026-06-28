// Custom-dictionary text replacement for dictation. The clinic's dictionary
// pairs a spoken form with an optional written form; when a written form is
// set, this module rewrites the spoken form in finalised transcript text
// ("BP" → "blood pressure", "ECG" → "electrocardiogram").
//
// This is the *pure* replacement pass — a sibling to voice-commands.ts. It runs
// on FINAL text only (the editor applies it to each text op after voice-command
// parsing), never on interim/partial text. Entries without a written form are
// recognition-only — they tune Deepgram via key terms (see deepgram-client.ts)
// but are not rewritten here.

export interface DictionaryReplacement {
  spokenForm: string;
  writtenForm: string | null;
}

/** A replacement compiled to its matcher — built once, applied per utterance. */
export interface DictionaryRule {
  pattern: RegExp;
  writtenForm: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Compile the active dictionary into ordered, ready-to-apply rules. Only
 * entries with a written form participate (the rest are recognition-only).
 * Longer spoken forms are ordered first so a multi-word term ("blood pressure")
 * wins before a shorter one it contains ("blood").
 *
 * Each rule matches its spoken form case-insensitively and only at
 * alphanumeric boundaries, so "BP" rewrites the word "BP" but not the "bp"
 * inside "subprime" or the "BP" in "BPM".
 */
export function compileDictionary(
  entries: DictionaryReplacement[],
): DictionaryRule[] {
  return entries
    .map((e) => ({
      spoken: e.spokenForm.trim(),
      written: (e.writtenForm ?? "").trim(),
    }))
    .filter((e) => e.spoken.length > 0 && e.written.length > 0)
    .sort((a, b) => b.spoken.length - a.spoken.length)
    .map((e) => ({
      pattern: new RegExp(
        `(?<![A-Za-z0-9])(?:${escapeRegExp(e.spoken)})(?![A-Za-z0-9])`,
        "gi",
      ),
      writtenForm: e.written,
    }));
}

/**
 * Apply pre-compiled rules to one finalised text run. The written form is
 * inserted verbatim — predictable for the dictionary author, who types it the
 * way it should read (acronyms aren't re-cased, and an expansion stays
 * lower-case mid-sentence). Matching itself is case-insensitive.
 */
export function applyCompiledDictionary(
  text: string,
  rules: DictionaryRule[],
): string {
  if (!text || rules.length === 0) return text;
  let result = text;
  for (const rule of rules) {
    rule.pattern.lastIndex = 0;
    result = result.replace(rule.pattern, rule.writtenForm);
  }
  return result;
}

/** Convenience: compile + apply in one call. Prefer the two-step form in hot paths. */
export function applyDictionary(
  text: string,
  entries: DictionaryReplacement[],
): string {
  return applyCompiledDictionary(text, compileDictionary(entries));
}
