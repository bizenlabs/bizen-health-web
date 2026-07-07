"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Editor } from "@tiptap/react";
import { TextSelection } from "@tiptap/pm/state";

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

const GUTTER_PX = 40;

interface Row {
  top: number; // px, relative to the wrapper's top edge
  height: number; // px, the line box height (for vertical centering)
}

// Block tags whose *empty* instances still occupy a visual row (a blank line)
// but hold no text node for the rect walk to find.
const EMPTY_BLOCK_SELECTOR =
  "p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, td, th";

/** Measure the top (and height) of every visual line box in the content. */
function measureRows(pmDom: HTMLElement, wrapper: HTMLElement): Row[] {
  const wrapTop = wrapper.getBoundingClientRect().top;
  const byTop = new Map<number, Row>();
  const add = (top: number, height: number) => {
    const rel = top - wrapTop;
    const key = Math.round(rel);
    const existing = byTop.get(key);
    // Keep the tallest box seen at this top so the number centres sensibly.
    if (!existing || height > existing.height) {
      byTop.set(key, { top: rel, height });
    }
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
      add(r.top, r.height);
    }
  }

  // Empty blocks (blank paragraph, empty list item, unfilled section) have no
  // text node — give them a number from their own box so blank lines count.
  pmDom.querySelectorAll<HTMLElement>(EMPTY_BLOCK_SELECTOR).forEach((el) => {
    if (el.textContent && el.textContent.trim()) return;
    const r = el.getBoundingClientRect();
    if (r.height === 0) return;
    add(r.top, r.height);
  });

  return [...byTop.values()].sort((a, b) => a.top - b.top);
}

/**
 * Wraps the editor's <EditorContent> and paints a scroll-following gutter of
 * visual-row numbers to its left. Clicking a number moves the caret to that row
 * (only while the editor is editable — never mid-dictation, where it would
 * hijack the insertion point).
 */
export function EditorLineRuler({
  editor,
  children,
}: {
  editor: Editor;
  children: ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const rafRef = useRef<number>(0);

  const recompute = useCallback(() => {
    const wrapper = wrapperRef.current;
    const pmDom = editor.view?.dom as HTMLElement | undefined;
    if (!wrapper || !pmDom) return;
    setRows(measureRows(pmDom, wrapper));
  }, [editor]);

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

  const goToRow = useCallback(
    (row: Row) => {
      const view = editor.view;
      if (!view.editable) return; // don't move the caret mid-dictation
      const pmRect = view.dom.getBoundingClientRect();
      const wrapRect = wrapperRef.current?.getBoundingClientRect();
      if (!wrapRect) return;
      const found = view.posAtCoords({
        left: pmRect.left + 8,
        top: wrapRect.top + row.top + row.height / 2,
      });
      if (!found) return;
      const { tr } = view.state;
      const sel = TextSelection.near(view.state.doc.resolve(found.pos));
      view.dispatch(tr.setSelection(sel).scrollIntoView());
      view.focus();
    },
    [editor],
  );

  const editable = editor.view?.editable ?? false;

  return (
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
  );
}
