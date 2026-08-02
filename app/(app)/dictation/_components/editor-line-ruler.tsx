"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { MicrophoneIcon, StopIcon } from "@heroicons/react/20/solid";
import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";
import clsx from "clsx";
import { useVoiceGoto } from "@/lib/transcription/use-voice-goto";

// A line-number ruler for the rich-text dictation editor. Unlike the template
// editor (a plain <textarea> where a line is a "\n"), the dictation editor is
// TipTap/ProseMirror WYSIWYG: content is formatted blocks (headings, paragraphs,
// list items, table cells) that wrap across a variable number of *visual* rows,
// with variable row heights. So there's no fixed row grid to stack numbers on.
//
// Instead we measure the real geometry: walk the rendered content, collect the
// top of every visual line box via Range.getClientRects(), dedupe by rounded
// top, and absolutely-position one number at each. Because the numbers track
// measured pixel positions, they stay aligned through headings, wrapping, and
// reflow — we just recompute on edit / resize / font load. Numbering resets to
// visual rows, matching a code-editor ruler.
//
// "Go to line X" (input / Ctrl+G / ruler click / voice) mirrors the template
// editor, resolved against the measured rows: line N is the Nth visual row.

const GUTTER_PX = 40;

interface Row {
  top: number; // px, relative to the wrapper's top edge
  height: number; // px, the line box height (for vertical centering)
  left: number; // px, relative to the wrapper's left edge — the text start,
  // so posAtCoords aims *inside* the text and not into a list/blockquote indent
}

// Block tags whose *empty* instances still occupy a visual row (a blank line)
// but hold no text node for the rect walk to find.
const EMPTY_BLOCK_SELECTOR =
  "p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, th";

/** Measure the top (and height) of every visual line box in the content. */
function measureRows(pmDom: HTMLElement, wrapper: HTMLElement): Row[] {
  const wrapRect = wrapper.getBoundingClientRect();
  const byTop = new Map<number, Row>();
  const add = (top: number, height: number, left: number) => {
    const relTop = top - wrapRect.top;
    const relLeft = left - wrapRect.left;
    const key = Math.round(relTop);
    const existing = byTop.get(key);
    if (!existing) {
      byTop.set(key, { top: relTop, height, left: relLeft });
      return;
    }
    // Same visual row seen again (e.g. a bold fragment): keep the tallest box
    // so the number centres sensibly, and the leftmost start so posAtCoords
    // aims at the beginning of the text.
    byTop.set(key, {
      top: existing.top,
      height: Math.max(existing.height, height),
      left: Math.min(existing.left, relLeft),
    });
  };

  // Real text lines — one rect per wrapped line fragment.
  const walker = document.createTreeWalker(pmDom, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    range.selectNodeContents(node);
    const rects = range.getClientRects();
    for (const r of rects) {
      if (r.height === 0) continue;
      add(r.top, r.height, r.left);
    }
  }

  // Empty blocks (blank paragraph, empty list item, unfilled section) have no
  // text node — give them a number from their own box so blank lines count.
  pmDom.querySelectorAll<HTMLElement>(EMPTY_BLOCK_SELECTOR).forEach((el) => {
    if (el.textContent && el.textContent.trim()) return;
    const r = el.getBoundingClientRect();
    if (r.height === 0) return;
    add(r.top, r.height, r.left);
  });

  return [...byTop.values()].sort((a, b) => a.top - b.top);
}

/**
 * Imperative handle for callers that need the ruler's line geometry without
 * moving the caret — specifically the spoken "go to line 12" command, which
 * fires mid-dictation (editor read-only) and must move the *dictation point*
 * rather than the selection.
 */
export interface LineRulerHandle {
  /**
   * Resolve a 1-based visual line to a document position. The line is clamped
   * to the note's measured range, and the clamped value is returned alongside
   * the position so the caller can say where it actually landed. Null when
   * nothing could be measured or the row didn't resolve to a position.
   */
  resolveLine: (n: number) => { pos: number; line: number } | null;
}

/**
 * Wraps the editor's <EditorContent> and paints a scroll-following gutter of
 * visual-row numbers to its left, plus (when the note is editable) a "go to
 * line" bar. Navigation moves the caret to the target row — only while the
 * editor is editable, never mid-dictation, where it would hijack the insertion
 * point. Voice is offered only once recording has fully stopped (`allowVoice`),
 * so its throwaway mic never contends with the live dictation mic.
 */
export function EditorLineRuler({
  editor,
  editable = false,
  allowVoice = false,
  ref,
  children,
}: {
  editor: Editor;
  editable?: boolean;
  allowVoice?: boolean;
  ref?: Ref<LineRulerHandle>;
  children: ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const gotoInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [gotoValue, setGotoValue] = useState("");
  const rafRef = useRef<number>(0);

  // Measure synchronously against the DOM as it stands right now. The `rows`
  // state below is a rAF-coalesced snapshot of this — fine for painting, but a
  // frame stale, so callers that must act on the *current* document (a spoken
  // "go to line") measure fresh instead.
  const measureNow = useCallback((): Row[] => {
    const wrapper = wrapperRef.current;
    const pmDom = editor.view?.dom as HTMLElement | undefined;
    if (!wrapper || !pmDom) return [];
    return measureRows(pmDom, wrapper);
  }, [editor]);

  const recompute = useCallback(() => {
    if (!wrapperRef.current || !editor.view?.dom) return;
    setRows(measureNow());
  }, [editor, measureNow]);

  // Coalesce bursts (a dictation utterance fires many transactions) into one
  // measure per frame — getClientRects() forces layout, so we don't want it per
  // transaction.
  const schedule = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(recompute);
  }, [recompute]);

  // Recompute when the document or its rendered layout changes.
  useEffect(() => {
    schedule();
    editor.on("update", schedule);
    editor.on("transaction", schedule);
    return () => {
      editor.off("update", schedule);
      editor.off("transaction", schedule);
      cancelAnimationFrame(rafRef.current);
    };
  }, [editor, schedule]);

  // Recompute on any size change of the wrapper or the content (wrapping shifts
  // when the pane width changes; content height changes as it grows).
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const pmDom = editor.view?.dom as HTMLElement | undefined;
    if (!wrapper) return;
    const ro = new ResizeObserver(schedule);
    ro.observe(wrapper);
    if (pmDom) ro.observe(pmDom);
    return () => ro.disconnect();
  }, [editor, schedule]);

  // Web fonts loading after mount reflow the text — remeasure once ready.
  useEffect(() => {
    const fonts = (
      document as Document & { fonts?: { ready?: Promise<unknown> } }
    ).fonts;
    fonts?.ready?.then(schedule);
  }, [schedule]);

  // Resolve a measured row to a document position.
  //
  // Aim ~one character into the row's own text, not at its exact start. Two
  // reasons: indented content (lists, blockquotes) resolves to the text rather
  // than the margin; and the very start of a *wrapped* line is a position that
  // also renders at the end of the previous line, so a caret set there lands
  // one row up — nudging inward disambiguates it.
  const posForRow = useCallback(
    (row: Row): number | null => {
      const wrapRect = wrapperRef.current?.getBoundingClientRect();
      if (!wrapRect) return null;
      const found = editor.view.posAtCoords({
        left: wrapRect.left + row.left + 8,
        top: wrapRect.top + row.top + row.height / 2,
      });
      return found ? found.pos : null;
    },
    [editor],
  );

  // Move the caret to the middle of a measured row and scroll it into view.
  const goToRow = useCallback(
    (row: Row) => {
      const view = editor.view;
      if (!view.editable) return; // don't move the caret mid-dictation
      const pos = posForRow(row);
      if (pos === null) return;
      const { tr } = view.state;
      const sel = TextSelection.near(view.state.doc.resolve(pos));
      view.dispatch(tr.setSelection(sel).scrollIntoView());
      view.focus();
    },
    [editor, posForRow],
  );

  // Jump to the Nth visual row (1-based), clamped to the document.
  const goToLine = useCallback(
    (n: number) => {
      if (rows.length === 0) return;
      const idx = Math.min(Math.max(1, Math.floor(n)), rows.length) - 1;
      goToRow(rows[idx]);
    },
    [rows, goToRow],
  );

  // Line geometry for the dictation editor's spoken "go to line N" — resolve
  // only, no caret move, and measured fresh so a line the current utterance
  // just created is already numbered.
  useImperativeHandle(
    ref,
    () => ({
      resolveLine: (n: number) => {
        const fresh = measureNow();
        if (fresh.length === 0) return null;
        const line = Math.min(Math.max(1, Math.floor(n)), fresh.length);
        const pos = posForRow(fresh[line - 1]);
        return pos === null ? null : { pos, line };
      },
    }),
    [measureNow, posForRow],
  );

  const submitGoto = useCallback(() => {
    const n = Number.parseInt(gotoValue, 10);
    if (Number.isFinite(n)) goToLine(n);
  }, [gotoValue, goToLine]);

  const voice = useVoiceGoto(goToLine);

  // Ctrl/Cmd+G focuses the "go to line" input (overriding the browser's native
  // "find next"). Only meaningful while the bar is shown.
  const onEditorKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!editable) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        gotoInputRef.current?.focus();
        gotoInputRef.current?.select();
      }
    },
    [editable],
  );

  return (
    <div onKeyDown={onEditorKeyDown}>
      {editable ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <label
            htmlFor="dictation-goto-line"
            className="font-medium text-zinc-500"
          >
            Go to line
          </label>
          <input
            id="dictation-goto-line"
            ref={gotoInputRef}
            type="number"
            min={1}
            max={rows.length || 1}
            inputMode="numeric"
            value={gotoValue}
            onChange={(e) => setGotoValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitGoto();
              }
            }}
            placeholder="#"
            aria-label={`Go to line (1–${rows.length || 1})`}
            className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono text-zinc-900 tabular-nums outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={submitGoto}
            className="rounded-md border border-zinc-200 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Go
          </button>
          {allowVoice ? <MicButton voice={voice} /> : null}
          <span className="ml-auto text-zinc-400 tabular-nums">
            {rows.length} {rows.length === 1 ? "line" : "lines"}
            <span className="ml-2 hidden sm:inline">
              <kbd className="rounded border border-zinc-200 px-1 dark:border-zinc-700">
                ⌘/Ctrl
              </kbd>
              +
              <kbd className="rounded border border-zinc-200 px-1 dark:border-zinc-700">
                G
              </kbd>
            </span>
          </span>
        </div>
      ) : null}

      <div ref={wrapperRef} className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-y-0 left-0 border-r border-zinc-100 select-none dark:border-zinc-800"
          style={{ width: GUTTER_PX }}
        >
          {rows.map((row, i) => (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              disabled={!editable}
              onClick={() => goToRow(row)}
              style={{ top: row.top + row.height / 2 }}
              className="absolute right-2 -translate-y-1/2 font-mono text-[10px] leading-none text-zinc-300 tabular-nums enabled:cursor-pointer enabled:hover:text-zinc-500 dark:text-zinc-600 dark:enabled:hover:text-zinc-400"
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div style={{ paddingLeft: GUTTER_PX + 8 }}>{children}</div>
      </div>
    </div>
  );
}

/** Mic toggle for spoken "go to line X" navigation. */
function MicButton({ voice }: { voice: ReturnType<typeof useVoiceGoto> }) {
  const listening = voice.state === "listening";
  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={voice.toggle}
        aria-pressed={listening}
        title={
          listening
            ? "Stop listening"
            : 'Speak a line to jump to (e.g. "go to line 12")'
        }
        className={clsx(
          "flex items-center gap-1 rounded-md border px-2 py-1 font-medium",
          listening
            ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900",
        )}
      >
        {listening ? (
          <StopIcon className="size-3.5" />
        ) : (
          <MicrophoneIcon className="size-3.5" />
        )}
        {listening ? "Listening…" : "Voice"}
      </button>
      {listening && voice.partial ? (
        <span className="max-w-40 truncate text-zinc-400 italic">
          “{voice.partial}”
        </span>
      ) : null}
      {voice.error ? (
        <span className="text-red-600 dark:text-red-400">{voice.error}</span>
      ) : null}
    </span>
  );
}
