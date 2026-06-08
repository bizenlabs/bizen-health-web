// Spoken voice commands for dictation. A clinician can say "new line", "new
// paragraph", "next section", "go to assessment", "scratch that", or "undo" and
// have it become a structure/navigation/editing action instead of literal text.
//
// This module is the *pure* parser: it turns one finalised Deepgram utterance
// into an ordered list of ops (text to insert, or a command to run). The editor
// (dictation-editor.tsx) maps each command onto a Tiptap/ProseMirror action.
//
// False positives are the core hazard — a clinician dictating "...a quiet
// period..." must not trigger a command. Two defences:
//   1. Whole-utterance matching for the risky commands (navigation + editing):
//      they fire ONLY when the entire utterance is the command, modulo filler
//      ("okay, …", "… please"). Deepgram's finals are pause-bounded, so a
//      command spoken on its own arrives as its own utterance.
//   2. Inline matching only for the low-risk whitespace commands ("new line",
//      "new paragraph"), which read naturally mid-sentence.
//
// Commands act on FINAL utterances only — never on interim/partial text.
//
// Spoken punctuation ("period", "comma", …) is supported but OPT-IN: Deepgram
// runs with `smart_format=true`, which already punctuates, so it's off by
// default and only applied when `opts.punctuation` is set.

export type VoiceCommand =
  | { kind: "newline" }
  | { kind: "paragraph" }
  | { kind: "nextSection" }
  | { kind: "prevSection" }
  | { kind: "gotoSection"; target: string; raw: string }
  | { kind: "scratchThat" }
  | { kind: "undo" };

export type VoiceOp =
  | { type: "text"; text: string }
  | { type: "command"; command: VoiceCommand };

export interface ParseOptions {
  /** Apply spoken-punctuation replacement to text ops. Default false. */
  punctuation?: boolean;
}

// Filler that can wrap a spoken command without changing its intent — stripped
// before the whole-utterance match so "okay, scratch that please" still fires.
const LEADING_FILLER = /^(?:ok(?:ay)?|um+|uh+|so|now|please|hey)[,\s]+/i;
const TRAILING_FILLER = /[\s,]+(?:please|now|thanks?)$/i;
// Trailing punctuation smart_format may have appended to a one-word command.
const TRAILING_PUNCT = /[.?!,]+$/;

// Whole-utterance command patterns (Tier B). Each is tested against the trimmed
// utterance after filler/punctuation stripping; a match consumes the whole
// utterance and emits no text (except gotoSection, which carries the raw text
// so the editor can fall back to literal insertion when no section matches).
const WHOLE_UTTERANCE: Array<{
  pattern: RegExp;
  command: (m: RegExpMatchArray, raw: string) => VoiceCommand;
}> = [
  { pattern: /^next section$/i, command: () => ({ kind: "nextSection" }) },
  {
    pattern: /^(?:previous section|prior section|go back a section)$/i,
    command: () => ({ kind: "prevSection" }),
  },
  {
    pattern: /^(?:go|jump|navigate|skip) to (.{1,40})$/i,
    command: (m, raw) => ({
      kind: "gotoSection",
      target: m[1].trim().toLowerCase(),
      raw,
    }),
  },
  {
    pattern: /^(?:scratch|delete) that$/i,
    command: () => ({ kind: "scratchThat" }),
  },
  { pattern: /^undo(?: that)?$/i, command: () => ({ kind: "undo" }) },
];

// Inline whitespace commands (Tier A) — low false-positive risk, spliced where
// they appear in the utterance.
const INLINE: Array<{ pattern: RegExp; command: VoiceCommand }> = [
  { pattern: /\bnew paragraph\b/gi, command: { kind: "paragraph" } },
  { pattern: /\b(?:new line|line break)\b/gi, command: { kind: "newline" } },
];

/** Build a case-insensitive word-boundary pattern for a phrase. */
function phrasePattern(phrase: string): RegExp {
  return new RegExp(`\\b${phrase}\\b`, "gi");
}

// Spoken-punctuation replacements (ported from the med-scribe desktop app).
// Line/paragraph breaks are intentionally excluded — those are handled
// structurally as `newline`/`paragraph` commands, not as literal "\n".
// Order matters: longer phrases first so they win over their substrings.
const PUNCTUATION_MAPPINGS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: phrasePattern("question mark"), replacement: "?" },
  { pattern: phrasePattern("exclamation mark"), replacement: "!" },
  { pattern: phrasePattern("exclamation point"), replacement: "!" },
  { pattern: phrasePattern("full stop"), replacement: "." },
  { pattern: phrasePattern("dot dot dot"), replacement: "..." },
  { pattern: phrasePattern("open quotation mark"), replacement: "“" },
  { pattern: phrasePattern("close quotation mark"), replacement: "”" },
  { pattern: phrasePattern("open quote"), replacement: "“" },
  { pattern: phrasePattern("close quote"), replacement: "”" },
  { pattern: phrasePattern("end quote"), replacement: "”" },
  { pattern: phrasePattern("open parenthesis"), replacement: "(" },
  { pattern: phrasePattern("close parenthesis"), replacement: ")" },
  { pattern: phrasePattern("open paren"), replacement: "(" },
  { pattern: phrasePattern("close paren"), replacement: ")" },
  { pattern: phrasePattern("period"), replacement: "." },
  { pattern: phrasePattern("comma"), replacement: "," },
  { pattern: phrasePattern("semicolon"), replacement: ";" },
  { pattern: phrasePattern("colon"), replacement: ":" },
  { pattern: phrasePattern("ellipsis"), replacement: "..." },
];

const NO_SPACE_BEFORE = new Set([
  ".",
  ",",
  "?",
  "!",
  ";",
  ":",
  ")",
  "”",
  "...",
]);
const NO_SPACE_AFTER = new Set(["(", "“"]);

/**
 * Replace spoken punctuation words with their characters and tidy the
 * surrounding spacing/capitalization. Applied to text ops only when the user
 * has opted into spoken-punctuation mode.
 */
export function applySpokenPunctuation(text: string): string {
  if (!text) return text;
  let result = text;

  for (const { pattern, replacement } of PUNCTUATION_MAPPINGS) {
    result = result.replace(pattern, replacement);
  }

  for (const punct of NO_SPACE_BEFORE) {
    const escaped = punct.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(` +${escaped}`, "g"), punct);
  }
  for (const punct of NO_SPACE_AFTER) {
    const escaped = punct.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    result = result.replace(new RegExp(`${escaped} +`, "g"), punct);
  }

  // Ensure a space after closing punctuation that runs into the next word.
  result = result.replace(/([.?!,;:)”])([A-Za-z])/g, "$1 $2");
  // Capitalize the first letter of a new sentence.
  result = result.replace(
    /([.?!])(\s+)([a-z])/g,
    (_m, p, s, l) => `${p}${s}${l.toUpperCase()}`,
  );

  return result.trim();
}

/** Strip leading/trailing filler and trailing punctuation for matching. */
function stripFiller(text: string): string {
  return text
    .replace(LEADING_FILLER, "")
    .replace(TRAILING_FILLER, "")
    .replace(TRAILING_PUNCT, "")
    .trim();
}

/** Match the whole (filler-stripped) utterance against a Tier-B command. */
function matchWholeUtterance(trimmed: string): VoiceCommand | null {
  const core = stripFiller(trimmed);
  for (const { pattern, command } of WHOLE_UTTERANCE) {
    const m = core.match(pattern);
    if (m) return command(m, trimmed);
  }
  return null;
}

/**
 * Split an utterance around inline whitespace commands, emitting alternating
 * text and command ops. Mirrors the token-splitting approach from med-scribe's
 * `extractSectionCommands`: collect all matches, drop overlaps, slice the text
 * around them.
 */
function splitInline(text: string): VoiceOp[] {
  interface Hit {
    start: number;
    end: number;
    command: VoiceCommand;
  }
  const hits: Hit[] = [];
  for (const { pattern, command } of INLINE) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(text)) !== null) {
      hits.push({ start: m.index, end: m.index + m[0].length, command });
    }
  }

  if (hits.length === 0) {
    const trimmed = text.trim();
    return trimmed ? [{ type: "text", text: trimmed }] : [];
  }

  hits.sort((a, b) => a.start - b.start);

  // Drop overlapping matches, keeping the earliest.
  const kept: Hit[] = [];
  let lastEnd = 0;
  for (const h of hits) {
    if (h.start >= lastEnd) {
      kept.push(h);
      lastEnd = h.end;
    }
  }

  const ops: VoiceOp[] = [];
  let pos = 0;
  for (const h of kept) {
    const before = text.slice(pos, h.start).trim();
    if (before) ops.push({ type: "text", text: before });
    ops.push({ type: "command", command: h.command });
    pos = h.end;
  }
  const after = text.slice(pos).trim();
  if (after) ops.push({ type: "text", text: after });
  return ops;
}

/**
 * Parse one finalised utterance into an ordered list of ops.
 *
 * - A whole-utterance command (navigation/editing) returns a single command op.
 * - Otherwise the text is split around inline whitespace commands, and — when
 *   `opts.punctuation` is set — spoken punctuation is applied to each text run.
 */
export function parseUtterance(text: string, opts?: ParseOptions): VoiceOp[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const whole = matchWholeUtterance(trimmed);
  if (whole) return [{ type: "command", command: whole }];

  const ops = splitInline(trimmed);
  if (!opts?.punctuation) return ops;

  return ops
    .map((op) =>
      op.type === "text"
        ? ({ type: "text", text: applySpokenPunctuation(op.text) } as VoiceOp)
        : op,
    )
    .filter((op) => op.type !== "text" || op.text.length > 0);
}
