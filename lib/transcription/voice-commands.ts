// Spoken voice commands for dictation. A clinician can say "new line", "new
// paragraph", "next line", "next section", "go to assessment", "scratch that",
// or "undo" and
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
  // Move the dictation point a line up/down within the section — unlike
  // "new line" (an inline Tier-A command), which *inserts* a line break.
  | { kind: "nextLine" }
  | { kind: "prevLine" }
  | { kind: "gotoSection"; target: string; raw: string }
  | { kind: "scratchThat" }
  | { kind: "undo" }
  // Table navigation/editing (Tier B — whole-utterance only). The editor maps
  // these onto prosemirror-tables actions and no-ops (with a warning flash)
  // when the dictation point isn't inside a table.
  | { kind: "nextCell" }
  | { kind: "prevCell" }
  | { kind: "cellUp" }
  | { kind: "cellDown" }
  | { kind: "nextRow" }
  | { kind: "addRow" }
  | { kind: "addColumn" }
  | { kind: "deleteRow" }
  | { kind: "deleteColumn" };

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
  // Whole-utterance only, and listed BEFORE the "go to <target>" pattern so
  // "go to next line" resolves here rather than as a gotoSection whose target
  // ("next line") would never match a heading and fall back to literal text.
  // "next line" mid-sentence stays prose — "next line of treatment" is common
  // clinical phrasing.
  {
    pattern: /^(?:next line|go to (?:the )?next line|down a line)$/i,
    command: () => ({ kind: "nextLine" }),
  },
  {
    pattern:
      /^(?:previous line|prior line|go to (?:the )?previous line|up a line|back a line)$/i,
    command: () => ({ kind: "prevLine" }),
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
  // --- Table navigation/editing. Each is fully anchored and mutually
  // exclusive from the section commands above ("next cell"/"next row" share no
  // words with "next section"). "tab" is intentionally NOT a synonym — a lone
  // spoken "tab" (e.g. a tablet) would misfire too easily in a clinical note.
  {
    pattern: /^(?:next cell|next column)$/i,
    command: () => ({ kind: "nextCell" }),
  },
  {
    pattern:
      /^(?:previous cell|prior cell|last cell|back a cell|previous column)$/i,
    command: () => ({ kind: "prevCell" }),
  },
  {
    pattern: /^(?:cell up|up a cell|cell above)$/i,
    command: () => ({ kind: "cellUp" }),
  },
  {
    pattern: /^(?:cell down|down a cell|cell below)$/i,
    command: () => ({ kind: "cellDown" }),
  },
  {
    pattern: /^(?:next row|new row|down a row)$/i,
    command: () => ({ kind: "nextRow" }),
  },
  {
    pattern: /^(?:add(?: a)? row|insert(?: a)? row|add row below)$/i,
    command: () => ({ kind: "addRow" }),
  },
  {
    pattern: /^(?:add(?: a)? column|insert(?: a)? column)$/i,
    command: () => ({ kind: "addColumn" }),
  },
  {
    pattern: /^(?:delete(?: this)? row|remove(?: this)? row)$/i,
    command: () => ({ kind: "deleteRow" }),
  },
  {
    pattern: /^(?:delete(?: this)? column|remove(?: this)? column)$/i,
    command: () => ({ kind: "deleteColumn" }),
  },
];

// Inline whitespace commands (Tier A) — low false-positive risk, spliced where
// they appear in the utterance. The trailing `[.,!?;:]*` absorbs punctuation
// that smart_format appends to the spoken command (e.g. "new line" comes back
// as "New line."); without it that stray "." would survive as a text op and
// land at the start of the new line/paragraph.
const INLINE: Array<{ pattern: RegExp; command: VoiceCommand }> = [
  { pattern: /\bnew paragraph\b[.,!?;:]*/gi, command: { kind: "paragraph" } },
  {
    pattern: /\b(?:new line|line break)\b[.,!?;:]*/gi,
    command: { kind: "newline" },
  },
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
 * Split a run of text into sentences on sentence-final punctuation followed by
 * whitespace, keeping the punctuation with the sentence it ends. A "." inside a
 * number ("0.5 mg") isn't followed by whitespace, so it doesn't split.
 *
 * This lets us recover a command Deepgram merged into the same final as dictated
 * text — smart_format puts a sentence boundary between them ("75 mg. Next cell.")
 * which whole-utterance matching would otherwise miss, dropping the command in as
 * literal text.
 */
function splitSentences(text: string): string[] {
  const out: string[] = [];
  const boundary = /([.!?]+)(\s+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = boundary.exec(text)) !== null) {
    const end = m.index + m[1].length; // keep the punctuation with this sentence
    out.push(text.slice(last, end).trim());
    last = m.index + m[0].length; // resume past the whitespace
  }
  if (last < text.length) out.push(text.slice(last).trim());
  return out.filter(Boolean);
}

/** Inline-split a text run and, when opted in, apply spoken punctuation. */
function parseBody(text: string, opts?: ParseOptions): VoiceOp[] {
  const ops = splitInline(text);
  if (!opts?.punctuation) return ops;

  return ops
    .map((op) =>
      op.type === "text"
        ? ({ type: "text", text: applySpokenPunctuation(op.text) } as VoiceOp)
        : op,
    )
    .filter((op) => op.type !== "text" || op.text.length > 0);
}

/**
 * Parse one finalised utterance into an ordered list of ops.
 *
 * - A whole-utterance command (navigation/editing) returns a single command op.
 * - A multi-sentence utterance is segmented so a sentence that is *itself* a
 *   command fires, even when Deepgram merged it with dictated text in one final
 *   ("75 mg. Next cell." → text + nextCell). Each command sentence must still
 *   match the anchored whole-utterance patterns, so prose merely *containing* a
 *   command phrase ("we examined the next cell.") won't fire.
 * - Otherwise the text is split around inline whitespace commands, and — when
 *   `opts.punctuation` is set — spoken punctuation is applied to each text run.
 */
export function parseUtterance(text: string, opts?: ParseOptions): VoiceOp[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const whole = matchWholeUtterance(trimmed);
  if (whole) return [{ type: "command", command: whole }];

  const sentences = splitSentences(trimmed);
  if (sentences.length > 1) {
    const ops: VoiceOp[] = [];
    for (const sentence of sentences) {
      const cmd = matchWholeUtterance(sentence);
      if (cmd) ops.push({ type: "command", command: cmd });
      else ops.push(...parseBody(sentence, opts));
    }
    return ops;
  }

  return parseBody(trimmed, opts);
}
