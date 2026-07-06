"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
  useCallback,
  useRef,
  useState,
} from "react";
import { MicrophoneIcon, StopIcon } from "@heroicons/react/20/solid";
import clsx from "clsx";
import { useVoiceGoto } from "@/lib/transcription/use-voice-goto";

/**
 * The template Markdown body editor: a monospace `<textarea>` paired with a
 * scroll-synced line-number ruler, so a clinician can navigate a long template
 * by line. Soft-wrapping is OFF (the textarea scrolls horizontally instead) so
 * every logical line is exactly one visual row and the ruler stays aligned;
 * this also keeps Markdown tables readable on a single row.
 *
 * "Go to line X" is offered four ways, all funnelling through `goToLine`:
 *   - the always-visible number input,
 *   - Ctrl/Cmd+G (focuses that input),
 *   - clicking a number in the ruler,
 *   - the mic button (speak "go to line twelve" — session-less, unbilled).
 *
 * The inner textarea is exposed via `textareaRef` so the parent's existing
 * "Insert variable" caret-splice keeps working against the same element.
 */
export function TemplateBodyEditor({
  value,
  onChange,
  textareaRef,
  name,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  name?: string;
  invalid?: boolean;
}) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const gotoInputRef = useRef<HTMLInputElement>(null);
  const [gotoValue, setGotoValue] = useState("");
  // The line the caret is on (1-based) — highlighted in the ruler so the user
  // always sees where they are, and updated after a jump.
  const [currentLine, setCurrentLine] = useState(1);

  const lineCount = value.length === 0 ? 1 : value.split("\n").length;

  // Keep the ruler pinned to the textarea's vertical scroll offset.
  const syncScroll = useCallback(() => {
    const ta = textareaRef.current;
    if (ta && gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop;
  }, [textareaRef]);

  // Recompute the caret's line whenever the selection might have moved.
  const updateCurrentLine = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const upto = value.slice(0, ta.selectionStart);
    setCurrentLine(upto.split("\n").length);
  }, [textareaRef, value]);

  // Place the caret at the start of line `n`, scroll it to the middle of the
  // viewport, and mark it active. Clamped to the document's line range.
  const goToLine = useCallback(
    (n: number) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const lines = value.split("\n");
      const target = Math.min(Math.max(1, Math.floor(n)), lines.length);

      let offset = 0;
      for (let i = 0; i < target - 1; i++) offset += lines[i].length + 1;

      ta.focus();
      ta.setSelectionRange(offset, offset);

      // Centre the target line using the textarea's real metrics rather than a
      // hard-coded row height, so it survives font/zoom changes.
      const cs = getComputedStyle(ta);
      const lineHeight = Number.parseFloat(cs.lineHeight) || 24;
      const padTop = Number.parseFloat(cs.paddingTop) || 0;
      const lineTop = padTop + (target - 1) * lineHeight;
      ta.scrollTop = Math.max(
        0,
        lineTop - ta.clientHeight / 2 + lineHeight / 2,
      );
      syncScroll();
      setCurrentLine(target);
    },
    [textareaRef, value, syncScroll],
  );

  const submitGoto = useCallback(() => {
    const n = Number.parseInt(gotoValue, 10);
    if (Number.isFinite(n)) goToLine(n);
  }, [gotoValue, goToLine]);

  const voice = useVoiceGoto(goToLine);

  // Ctrl/Cmd+G anywhere in the editor focuses the "go to line" input (and
  // overrides the browser's native "find next").
  const onEditorKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        gotoInputRef.current?.focus();
        gotoInputRef.current?.select();
      }
    },
    [],
  );

  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);

  return (
    <div onKeyDown={onEditorKeyDown}>
      {/* Navigation toolbar */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <label
          htmlFor="template-goto-line"
          className="font-medium text-zinc-500"
        >
          Go to line
        </label>
        <input
          id="template-goto-line"
          ref={gotoInputRef}
          type="number"
          min={1}
          max={lineCount}
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
          aria-label={`Go to line (1–${lineCount})`}
          className="w-16 rounded-md border border-zinc-200 bg-white px-2 py-1 font-mono text-zinc-900 tabular-nums outline-none focus:border-blue-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={submitGoto}
          className="rounded-md border border-zinc-200 px-2 py-1 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Go
        </button>
        <MicButton voice={voice} />
        <span className="ml-auto text-zinc-400 tabular-nums">
          {lineCount} {lineCount === 1 ? "line" : "lines"}
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

      {/* Editor box: ruler + textarea */}
      <div
        className={clsx(
          "flex h-[34rem] overflow-hidden rounded-lg border bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-inset dark:bg-white/5",
          invalid
            ? "border-red-500 dark:border-red-600"
            : "border-zinc-950/10 dark:border-white/10",
        )}
      >
        <div
          ref={gutterRef}
          aria-hidden="true"
          className="h-full shrink-0 overflow-hidden border-r border-zinc-950/5 bg-zinc-50 py-2 pr-2 pl-3 text-right font-mono text-sm/6 text-zinc-400 select-none dark:border-white/5 dark:bg-white/5"
          style={{ minWidth: `${String(lineCount).length + 2}ch` }}
        >
          {lineNumbers.map((n) => (
            <button
              key={n}
              type="button"
              tabIndex={-1}
              onClick={() => goToLine(n)}
              className={clsx(
                "block w-full cursor-pointer text-right leading-6 tabular-nums hover:text-zinc-700 dark:hover:text-zinc-200",
                n === currentLine &&
                  "font-semibold text-blue-600 dark:text-blue-400",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onClick={updateCurrentLine}
          onKeyUp={updateCurrentLine}
          onSelect={updateCurrentLine}
          wrap="off"
          spellCheck={false}
          className="h-full w-full resize-none overflow-auto bg-transparent px-3 py-2 font-mono text-sm/6 whitespace-pre text-zinc-950 outline-none dark:text-white"
        />
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
