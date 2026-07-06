// Parser for the template editor's "go to line X" voice navigation. A user
// speaks a line number ("go to line twelve", "line 12", "jump to line one
// hundred") and this turns the finalised Deepgram utterance into a 1-based line
// number the editor can jump to.
//
// It is intentionally narrow: a match REQUIRES the word "line" so ordinary
// dictated prose containing a number ("she is 42") never triggers navigation.
// Both numerals (Deepgram's smart_format usually returns "12") and spoken
// number words are accepted, so recognition quirks don't break the command.

const UNITS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  // Common homophones smart_format may return for small numbers.
  to: 2,
  too: 2,
  for: 4,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

/**
 * Fold a run of spoken number words into an integer. Handles units, teens,
 * tens (+ unit) and hundreds ("one hundred twenty three" → 123), stopping at
 * the first token that isn't part of a number. Returns null if no number word
 * was seen.
 */
function wordsToNumber(tokens: string[]): number | null {
  let result = 0;
  let current = 0;
  let matched = false;

  for (const t of tokens) {
    if (t === "hundred") {
      current = (current || 1) * 100;
      matched = true;
    } else if (t === "thousand") {
      result += (current || 1) * 1000;
      current = 0;
      matched = true;
    } else if (UNITS[t] !== undefined) {
      current += UNITS[t];
      matched = true;
    } else if (TENS[t] !== undefined) {
      current += TENS[t];
      matched = true;
    } else if (t === "and") {
      // filler inside a spoken number ("a hundred and two") — skip
      continue;
    } else {
      break;
    }
  }

  return matched ? result + current : null;
}

/**
 * Parse one finalised utterance into a 1-based line number, or null if it isn't
 * a "go to line" command. The utterance must contain the word "line" followed
 * by a number (numeral or spoken words).
 */
export function parseGotoLine(utterance: string): number | null {
  if (!utterance) return null;

  const text = utterance
    .toLowerCase()
    .replace(/[.,!?]+$/, "")
    .trim();

  // "line" as a whole word (so "underline"/"deadline" don't match), then the
  // rest of the utterance as the number to parse.
  const m = text.match(/\bline\s+(?:number\s+)?(.+)$/);
  if (!m) return null;

  const tail = m[1].trim();

  // Numerals first — the common case with smart_format ("go to line 12").
  const digits = tail.match(/^#?\s*(\d{1,5})\b/);
  if (digits) {
    const n = Number.parseInt(digits[1], 10);
    return n >= 1 ? n : null;
  }

  // Otherwise fold spoken number words.
  const tokens = tail.split(/[\s-]+/).filter(Boolean);
  const n = wordsToNumber(tokens);
  return n && n >= 1 ? n : null;
}
