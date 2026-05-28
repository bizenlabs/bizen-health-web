"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  DocumentTextIcon,
  MicrophoneIcon,
  PauseIcon,
  PencilSquareIcon,
  PlayIcon,
  StopIcon,
} from "@heroicons/react/20/solid";
import clsx from "clsx";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { EditorState } from "@tiptap/pm/state";
import {
  editTranscriptionNoteAction,
  reopenTranscriptionAction,
} from "@/app/(app)/transcription-actions";
import {
  type LiveSegment,
  useTranscription,
} from "@/lib/transcription/use-transcription";
import { TemplateHint } from "./template-hint-extension";

// The unified dictation editor — one Tiptap surface for the whole lifecycle.
// While the mic is live the editor is read-only and finalised utterances are
// *incrementally inserted* at a tracked position; the in-progress (partial)
// text is shown italic at the same spot and replaced on every update. On stop
// the editor becomes editable and auto-saves.
//
// With a template, the cursor lands inside the first paragraph after the
// first heading so dictation drops into the section structure rather than at
// the very end of the scaffold. Clinicians can also click into a section
// before pressing Resume to dictate there — the position is carried across
// the navigation via sessionStorage.

// Carries the intake's microphone choice across the navigation to this page.
const DEVICE_KEY = "bizen:dictation:device";
// Carries the editor's cursor across the editing → resume-recording
// navigation. Read once on the next mount and cleared.
const CURSOR_KEY = "bizen:dictation:cursor";

type Phase = "recording" | "editing" | "voided";
type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Recreate the editor state so the undo stack drops streamed/seeded edits. */
function resetHistory(editor: Editor) {
  const { state, view } = editor;
  view.updateState(
    EditorState.create({
      doc: state.doc,
      plugins: state.plugins,
      selection: state.selection,
    }),
  );
}

// Markdown collapses consecutive headings — there is no paragraph node between
// `## A` and `## B`. Walk the doc and insert an empty paragraph after every
// heading that lacks one, so every section has a writable slot for the
// cursor to land in.
function ensureTemplateStructure(editor: Editor) {
  const { paragraph } = editor.schema.nodes;
  const positions: number[] = [];
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name !== "heading") return;
    const afterHeading = offset + node.nodeSize;
    const $pos = editor.state.doc.resolve(afterHeading);
    if (!$pos.nodeAfter || $pos.nodeAfter.type.name !== "paragraph") {
      positions.push(afterHeading);
    }
  });
  if (positions.length === 0) return;
  let tr = editor.state.tr;
  for (let i = positions.length - 1; i >= 0; i--) {
    tr = tr.insert(positions[i], paragraph.create());
  }
  editor.view.dispatch(tr);
}

/** Position inside the first paragraph after the first top-level heading. */
function findPositionAfterFirstHeading(editor: Editor): number | null {
  let foundHeading = false;
  let result: number | null = null;
  editor.state.doc.forEach((node, offset) => {
    if (result !== null) return;
    if (node.type.name === "heading") {
      foundHeading = true;
      return;
    }
    if (foundHeading && node.type.name === "paragraph") {
      result = offset + 1;
    }
  });
  return result;
}

function blockHasContent(editor: Editor, pos: number): boolean {
  try {
    const $pos = editor.state.doc.resolve(pos);
    return $pos.parent.textContent.length > 0;
  } catch {
    return false;
  }
}

function joinSegments(segs: { text: string }[]): string {
  return segs
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join(" ");
}

export function DictationEditor({
  transcriptionId,
  templateId,
  templateName,
  templateContent,
  initialNote,
  transcriptText,
  initialSegments,
  voided,
  autoRecord,
}: {
  transcriptionId: string;
  templateId: string | null;
  templateName: string | null;
  // The template's Markdown scaffold — shown above the transcript so the
  // clinician dictates into the structure. Null for a free-form dictation.
  templateContent: string | null;
  initialNote: string | null;
  transcriptText: string;
  // Finalised segments already on the session — seeded into a resumed
  // recording so it appends to the existing transcript.
  initialSegments: LiveSegment[];
  voided: boolean;
  autoRecord: boolean;
}) {
  const router = useRouter();
  const { state, error, segments, partial, start, pause, resume, stop } =
    useTranscription();

  const [stopped, setStopped] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  // `phase` is derived, not stored — it has no transition the user can't
  // express as "voided / recording done / still recording". A paused session
  // is still in the recording phase: the editor stays read-only and the
  // transcript stream is just temporarily muted.
  const phase: Phase = voided
    ? "voided"
    : !autoRecord || stopped || state === "error"
      ? "editing"
      : "recording";

  const paused = state === "paused";

  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  // Flips true the first time the init effect seeds the editor — gates the
  // streaming effect so it doesn't run before insertPos is resolved.
  const initRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The doc position where the next chunk of finalised text will go. Tracked
  // so dictation lands inside a section instead of at the very end. `null`
  // until the init effect resolves it.
  const insertPosRef = useRef<number | null>(null);
  // How many of `segments` have already been inserted into the editor. Seeded
  // to `initialSegments.length` because those land in the editor as part of
  // the seeded Markdown, not via the stream.
  const processedSegCountRef = useRef<number>(0);
  // Where the current tentative (italic) partial text lives so it can be
  // deleted before the next tick replaces it.
  const partialRangeRef = useRef<{ from: number; length: number } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      Placeholder.configure({
        placeholder: "Your dictated note will appear here…",
      }),
      TemplateHint,
    ],
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm prose-zinc dark:prose-invert max-w-none min-h-full focus:outline-none",
      },
    },
  });

  // Toolbar reflects live editor state — re-render on every transaction.
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!editor) return;
    editor.on("transaction", forceUpdate);
    return () => {
      editor.off("transaction", forceUpdate);
    };
  }, [editor]);

  // --- Persistence -----------------------------------------------------
  const doSave = useCallback(
    async (markdown: string) => {
      setSaveStatus("saving");
      const res = await editTranscriptionNoteAction(
        transcriptionId,
        markdown,
        null,
      );
      setSaveStatus(res.ok ? "saved" : "error");
    },
    [transcriptionId],
  );

  const scheduleSave = useCallback(
    (markdown: string) => {
      setSaveStatus("saving");
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void doSave(markdown), 1200);
    },
    [doSave],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  // Save genuine user edits. Programmatic stream inserts fire `update` too,
  // but they're gated out by the `phase !== "editing"` check.
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      if (phase !== "editing") return;
      scheduleSave(editor.getMarkdown());
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor, phase, scheduleSave]);

  // --- Recording: kick off the session once -----------------------------
  useEffect(() => {
    if (startedRef.current || phase !== "recording") return;
    startedRef.current = true;
    let deviceId: string | null = null;
    try {
      deviceId = sessionStorage.getItem(DEVICE_KEY);
    } catch {
      /* sessionStorage unavailable — fall back to the default mic */
    }
    void start(
      { mode: "DICTATION", templateId },
      { existingId: transcriptionId, deviceId, seedSegments: initialSegments },
    );
  }, [phase, start, templateId, transcriptionId, initialSegments]);

  // --- One-shot init: seed the editor and place insertPos ---------------
  useEffect(() => {
    if (!editor || initRef.current) return;

    const templateBody = templateContent?.trim() ?? "";
    const transcriptBody = transcriptText?.trim() ?? "";

    if (initialNote) {
      // Clinician has a saved version of this note — load it as-is.
      editor.commands.setContent(initialNote, {
        contentType: "markdown",
        emitUpdate: false,
      });
    } else if (templateBody && transcriptBody) {
      // Pre-save state with raw transcript collected — show both.
      editor.commands.setContent(`${templateBody}\n\n${transcriptBody}`, {
        contentType: "markdown",
        emitUpdate: false,
      });
    } else if (templateBody) {
      editor.commands.setContent(templateBody, {
        contentType: "markdown",
        emitUpdate: false,
      });
    } else if (transcriptBody) {
      editor.commands.setContent(transcriptBody, {
        contentType: "markdown",
        emitUpdate: false,
      });
    }

    if (templateBody) ensureTemplateStructure(editor);

    // Where dictation should land.
    let pos: number | null = null;

    // 1. A cursor persisted by the Resume button on the previous sitting.
    try {
      const stored = sessionStorage.getItem(CURSOR_KEY);
      if (stored !== null) {
        sessionStorage.removeItem(CURSOR_KEY);
        const n = Number.parseInt(stored, 10);
        const max = Math.max(1, editor.state.doc.content.size - 1);
        if (Number.isFinite(n) && n >= 1 && n <= max) pos = n;
      }
    } catch {
      /* sessionStorage unavailable */
    }

    // 2. Templated: first paragraph after the first heading.
    if (pos === null && templateBody) {
      pos = findPositionAfterFirstHeading(editor);
    }

    // 3. Fallback: end of doc.
    if (pos === null) {
      pos = Math.max(1, editor.state.doc.content.size - 1);
    }

    insertPosRef.current = pos;
    // Seed segments already live in the editor as part of the seeded markdown
    // — mark them processed so the stream doesn't double-insert them.
    processedSegCountRef.current = initialSegments.length;
    resetHistory(editor);
    initRef.current = true;
  }, [editor, initialNote, templateContent, transcriptText, initialSegments]);

  // --- Stream finalised + partial text at insertPos ---------------------
  useEffect(() => {
    if (!editor || !initRef.current || phase !== "recording") return;
    if (insertPosRef.current === null) return;

    // Drop any tentative partial from the previous tick before we change
    // anything else — its range is only valid against the current doc.
    const range = partialRangeRef.current;
    if (range) {
      editor.commands.deleteRange({
        from: range.from,
        to: range.from + range.length,
      });
      partialRangeRef.current = null;
    }

    // Insert anything newly finalised at insertPos, advancing it past the
    // inserted text so the next chunk continues where this one ended.
    if (segments.length > processedSegCountRef.current) {
      const text = joinSegments(segments.slice(processedSegCountRef.current));
      processedSegCountRef.current = segments.length;
      if (text) {
        const from = insertPosRef.current;
        const insert = (blockHasContent(editor, from) ? " " : "") + text;
        editor.commands.insertContentAt(from, insert);
        insertPosRef.current = from + insert.length;
      }
    }

    // Re-show the live partial at the (possibly advanced) insertPos.
    if (partial?.text) {
      const from = insertPosRef.current;
      const insert = (blockHasContent(editor, from) ? " " : "") + partial.text;
      editor.commands.insertContentAt(from, {
        type: "text",
        text: insert,
        marks: [{ type: "italic" }],
      });
      partialRangeRef.current = { from, length: insert.length };
    }

    // Keep the insertion point visible — only nudge if it has drifted off.
    const container = scrollRef.current;
    if (container) {
      try {
        const coords = editor.view.coordsAtPos(insertPosRef.current);
        const rect = container.getBoundingClientRect();
        if (coords.top < rect.top + 40 || coords.bottom > rect.bottom - 40) {
          container.scrollTop += coords.top - (rect.top + rect.height / 2);
        }
      } catch {
        /* coordsAtPos can throw mid-transaction — skip the scroll */
      }
    }
  }, [editor, phase, segments, partial]);

  // Keep `editable` in step with the phase. The `false` suppresses the
  // update event — toggling editable is not a content change and must not
  // trip the auto-save.
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(phase === "editing", false);
  }, [editor, phase]);

  // Warn before navigating away mid-recording — audio can't be resumed.
  useEffect(() => {
    if (phase !== "recording") return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  const recording =
    state === "starting" || state === "recording" || state === "paused";

  async function handleStop() {
    const result = await stop();
    if (editor) {
      // Drop any lingering partial first.
      const range = partialRangeRef.current;
      if (range) {
        editor.commands.deleteRange({
          from: range.from,
          to: range.from + range.length,
        });
        partialRangeRef.current = null;
      }
      // Insert anything finalised but not yet picked up by the stream effect.
      const finalSegments = result?.segments ?? segments;
      if (
        finalSegments.length > processedSegCountRef.current &&
        insertPosRef.current !== null
      ) {
        const text = joinSegments(
          finalSegments.slice(processedSegCountRef.current),
        );
        processedSegCountRef.current = finalSegments.length;
        if (text) {
          const from = insertPosRef.current;
          const insert = (blockHasContent(editor, from) ? " " : "") + text;
          editor.commands.insertContentAt(from, insert);
          insertPosRef.current = from + insert.length;
        }
      }
      resetHistory(editor);
      void doSave(editor.getMarkdown());
    }
    setStopped(true);
  }

  // Resume a finalised dictation. Reopen it server-side, persist the current
  // cursor so the new sitting picks up where the clinician put it, then
  // navigate with a fresh `record` value — the page keys the editor on it, so
  // this remounts straight into a new recording session.
  async function handleResume() {
    setResuming(true);
    setResumeError(null);
    if (editor) {
      try {
        sessionStorage.setItem(
          CURSOR_KEY,
          String(editor.state.selection.anchor),
        );
      } catch {
        /* sessionStorage unavailable */
      }
    }
    const res = await reopenTranscriptionAction(transcriptionId);
    if (res.ok) {
      router.push(`/dictation/${transcriptionId}?record=${Date.now()}`);
    } else {
      setResumeError(res.error);
      setResuming(false);
    }
  }

  const TemplateGlyph = templateName ? DocumentTextIcon : PencilSquareIcon;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
      {voided ? (
        <p className="border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs text-amber-800 sm:px-8 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          This dictation has been deleted — it is read-only.
        </p>
      ) : null}

      {/* Header — status readout + primary action */}
      <div className="flex items-center justify-between gap-3 px-6 pt-5 sm:px-8">
        <span className="flex items-center gap-2">
          <span
            className={clsx(
              "size-1.5 rounded-full",
              paused
                ? "bg-amber-500"
                : recording
                  ? "animate-pulse bg-red-500"
                  : "bg-zinc-200 dark:bg-zinc-700",
            )}
          />
          <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-zinc-400 uppercase dark:text-zinc-500">
            {paused
              ? "Paused"
              : recording
                ? "Recording"
                : voided
                  ? "Deleted"
                  : "Note"}
          </span>
        </span>

        {recording ? (
          <span className="flex items-center gap-2">
            {paused ? (
              <button
                type="button"
                onClick={resume}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3.5 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              >
                <PlayIcon aria-hidden="true" className="size-4" />
                Resume
              </button>
            ) : (
              <button
                type="button"
                onClick={pause}
                disabled={state === "starting"}
                className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                <PauseIcon aria-hidden="true" className="size-4" />
                Pause
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleStop()}
              disabled={state === "starting"}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3.5 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              <StopIcon aria-hidden="true" className="size-4" />
              {state === "starting" ? "Starting…" : "Stop"}
            </button>
          </span>
        ) : (
          <span className="flex items-center gap-3">
            {phase === "editing" ? (
              <button
                type="button"
                onClick={() => void handleResume()}
                disabled={resuming}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3.5 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              >
                <MicrophoneIcon aria-hidden="true" className="size-4" />
                {resuming ? "Resuming…" : "Resume recording"}
              </button>
            ) : null}
            <span className="font-mono text-[10px] tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
              {saveLabel(saveStatus)}
            </span>
          </span>
        )}
      </div>

      {/* Note format */}
      <p className="flex items-center gap-1.5 px-6 pt-2 font-mono text-[11px] tracking-wide text-zinc-400 sm:px-8 dark:text-zinc-500">
        <TemplateGlyph aria-hidden="true" className="size-3.5" />
        {templateName ?? "Free-form dictation"}
      </p>

      {error || resumeError ? (
        <p className="mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:mx-8 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error ?? resumeError}
        </p>
      ) : null}

      {/* Toolbar — only while editable */}
      {phase === "editing" && editor ? (
        <Toolbar editor={editor} />
      ) : (
        <div className="mt-4" />
      )}

      {/* Editor body — fills the remaining height, scrolls within. */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 sm:px-8 sm:pb-8"
      >
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800/60" />
        )}
      </div>
    </div>
  );
}

function saveLabel(status: SaveStatus): string {
  switch (status) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error":
      return "Save failed";
    default:
      return "Auto-saves";
  }
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1 border-y border-zinc-100 px-6 py-1.5 sm:px-8 dark:border-zinc-800/80">
      <ToolBtn
        label="B"
        bold
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolBtn
        label="I"
        italic
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolSep />
      <ToolBtn
        label="H1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolBtn
        label="H2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolSep />
      <ToolBtn
        label="•"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolBtn
        label="1."
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolSep />
      <ToolBtn
        label={<ArrowUturnLeftIcon aria-hidden="true" className="size-3.5" />}
        ariaLabel="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolBtn
        label={<ArrowUturnRightIcon aria-hidden="true" className="size-3.5" />}
        ariaLabel="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
}

function ToolSep() {
  return <span className="mx-1 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />;
}

function ToolBtn({
  label,
  ariaLabel,
  active = false,
  bold = false,
  italic = false,
  disabled = false,
  onClick,
}: {
  label: React.ReactNode;
  ariaLabel?: string;
  active?: boolean;
  bold?: boolean;
  italic?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs transition-colors disabled:opacity-30",
        bold && "font-bold",
        italic && "font-serif italic",
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
      )}
    >
      {label}
    </button>
  );
}
