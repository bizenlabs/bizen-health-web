import type { Editor } from "@tiptap/react";
import { tableLineIndices } from "@/lib/markdown-table";

// Template helper text — `[placeholder]` and `(instruction)` — is authored
// into the template body purely as guidance. It must NOT become editable
// document content: a clinician should never be able to type over half of a
// hint, restyle it, or have it persisted into the saved note. (This mirrors
// the med-scribe app, where placeholders are non-editable ghost text.)
//
// The mechanism: strip the helper text out of the seeded Markdown entirely,
// then re-surface each `[...]` hint as a Tiptap *placeholder* (a CSS
// `::before` on an empty node) anchored to the section it came from. Empty
// nodes carry no text, so the hint can't be selected, formatted, or saved —
// it simply vanishes the moment the clinician dictates or types into that
// node.

export interface TemplateHint {
  /** Text of the nearest non-empty line above the hint — its section label. */
  precedingText: string;
  /** The guidance text extracted from `[brackets]`. */
  hint: string;
}

export interface CleanedTemplate {
  cleanedMarkdown: string;
  hints: TemplateHint[];
}

/** Strip Markdown formatting (bold, headings, list markers) for matching. */
export function normalizeLabel(text: string): string {
  return text
    .replace(/\*+/g, "")
    .replace(/^[-*+\d.#]+\s*/, "")
    .trim();
}

/**
 * Clean a raw template body for display in the editor.
 *
 * - `[hint text]` → stripped, extracted as a {@link TemplateHint}
 * - `(instruction text)` → stripped entirely (authoring guidance)
 * - Structural Markdown (headings, labels, list markers) preserved
 *
 * Hints are matched back to editor nodes by their `precedingText` — the text
 * of the nearest non-empty label above where the hint appeared.
 */
export function cleanTemplateForEditor(rawBody: string): CleanedTemplate {
  const hints: TemplateHint[] = [];
  const lines = rawBody.split("\n");
  // Pipe-table rows are passed through verbatim: their `[placeholder]` cells
  // are meant to seed the table as editable cell text, not to be stripped into
  // ghost hints (an empty table reads as broken, not as guidance).
  const tableLines = tableLineIndices(lines);
  const cleanedLines: string[] = [];
  let lastNonEmptyText = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (tableLines.has(i)) {
      cleanedLines.push(line);
      lastNonEmptyText = line.trim();
      continue;
    }

    const trimmed = line.trim();

    // Drop lines that are entirely a parenthetical instruction.
    if (/^\(.*\)$/.test(trimmed)) continue;

    // Strip inline parentheticals.
    let cleaned = line.replace(/\s*\([^)]+\)\s*/g, "");

    // Extract bracket hints.
    const bracketPattern = /\[([^\]]+)\]/g;
    const lineHints: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = bracketPattern.exec(cleaned)) !== null) {
      lineHints.push(match[1]);
    }

    // Remove bracket text from the line.
    cleaned = cleaned.replace(/\s*\[[^\]]+\]\s*/g, " ").replace(/\s+/g, " ");

    // Clean up trailing separators (e.g. "1. — " → "1.").
    cleaned = cleaned.replace(/\s*—\s*$/, "").replace(/\s+$/, "");

    // Does the line still carry meaningful content after stripping?
    const meaningful = cleaned.replace(/^[\s\-*+\d.#]+$/, "").trim();

    if (lineHints.length > 0) {
      const combinedHint = lineHints.join(" — ");
      if (meaningful) {
        // Line has label content (e.g. "**Chief Complaint:**") — keep it.
        cleanedLines.push(cleaned);
        lastNonEmptyText = cleaned.trim();
      }
      hints.push({ precedingText: lastNonEmptyText, hint: combinedHint });
    } else {
      cleanedLines.push(cleaned);
      if (cleaned.trim()) lastNonEmptyText = cleaned.trim();
    }
  }

  // Collapse 3+ consecutive blank lines into 2.
  const collapsed: string[] = [];
  let consecutiveBlanks = 0;
  for (const line of cleanedLines) {
    if (line.trim() === "") {
      consecutiveBlanks++;
      if (consecutiveBlanks <= 2) collapsed.push(line);
    } else {
      consecutiveBlanks = 0;
      collapsed.push(line);
    }
  }

  return { cleanedMarkdown: collapsed.join("\n").trim(), hints };
}

/**
 * Insert empty paragraph nodes after each label node that has a matching
 * hint, giving the placeholder renderer concrete empty nodes to attach hint
 * text to. (Markdown blank lines don't survive as empty ProseMirror nodes,
 * so the slots must be created explicitly.) Done in a no-history transaction.
 */
export function insertHintNodes(editor: Editor, hints: TemplateHint[]): void {
  if (!hints.length) return;

  // Group hints by their normalized preceding label (preserving order).
  const hintsByLabel = new Map<string, TemplateHint[]>();
  for (const hint of hints) {
    const key = normalizeLabel(hint.precedingText);
    const list = hintsByLabel.get(key) ?? [];
    list.push(hint);
    hintsByLabel.set(key, list);
  }

  const insertions: { pos: number; count: number }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isTextblock) return;
    const text = node.textContent.trim();
    if (!text) return;
    const key = normalizeLabel(text);
    const hintList = hintsByLabel.get(key);
    if (hintList && hintList.length > 0) {
      insertions.push({ pos: pos + node.nodeSize, count: hintList.length });
      hintsByLabel.delete(key); // consume all hints for this label
    }
  });

  if (!insertions.length) return;

  const { tr } = editor.state;
  // Insert bottom-to-top so earlier positions stay valid.
  for (let i = insertions.length - 1; i >= 0; i--) {
    const { pos, count } = insertions[i];
    for (let j = 0; j < count; j++) {
      tr.insert(pos, editor.schema.nodes.paragraph.create());
    }
  }
  tr.setMeta("addToHistory", false);
  editor.view.dispatch(tr);
}

/**
 * Build the function passed to Tiptap's Placeholder extension. It maps each
 * empty textblock to the hint that belongs to its section, so every empty
 * slot shows its own guidance rather than a single global placeholder.
 *
 * Reads hints from a ref so the function identity stays stable across
 * renders (the Placeholder extension is configured once).
 */
export function buildPlaceholderFn(
  hintsRef: { current: TemplateHint[] },
  emptyFallback: string,
): (props: {
  node: { textContent: string };
  pos: number;
  editor: Editor;
}) => string {
  // Cache the position→hint map per doc instance to avoid re-walking on every
  // node. ProseMirror creates a fresh doc object on each update, so identity
  // change is a safe cache key.
  let cachedDoc: unknown = null;
  let cachedMap = new Map<number, string>();

  return ({ node, pos, editor }) => {
    if (node.textContent.length > 0) return "";

    const hints = hintsRef.current;
    if (!hints || hints.length === 0) {
      // No template — show the default only when the editor is fully empty.
      return editor.state.doc.textContent.length === 0 ? emptyFallback : "";
    }

    const doc = editor.state.doc;
    if (doc !== cachedDoc) {
      cachedDoc = doc;
      cachedMap = new Map();

      const hintsByPrecedingText = new Map<string, TemplateHint[]>();
      for (const hint of hints) {
        const key = normalizeLabel(hint.precedingText);
        const list = hintsByPrecedingText.get(key) ?? [];
        list.push(hint);
        hintsByPrecedingText.set(key, list);
      }

      // For each empty textblock, match it to the nearest preceding non-empty
      // label, so hints stay anchored to their section as others fill in.
      let lastNonEmptyLabel = "";
      doc.descendants((n, p) => {
        if (!n.isTextblock) return;
        if (n.content.size > 0) {
          lastNonEmptyLabel = normalizeLabel(n.textContent.trim());
        } else {
          const list = hintsByPrecedingText.get(lastNonEmptyLabel);
          if (list && list.length > 0) {
            cachedMap.set(p, list.shift()!.hint);
            if (list.length === 0) {
              hintsByPrecedingText.delete(lastNonEmptyLabel);
            }
          }
        }
      });
    }

    return cachedMap.get(pos) ?? "";
  };
}

/** Position inside the first empty textblock — the first hint slot. */
export function findFirstEmptyTextblock(editor: Editor): number | null {
  let result: number | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (result !== null) return false;
    if (node.isTextblock && node.content.size === 0) {
      result = pos + 1;
      return false;
    }
  });
  return result;
}
