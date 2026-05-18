"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {
  ArrowUturnLeftIcon,
  ArrowUturnRightIcon,
  DocumentTextIcon,
  PencilSquareIcon,
  StopIcon,
} from "@heroicons/react/20/solid";
import clsx from "clsx";
import {
  type Editor,
  EditorContent,
  type JSONContent,
  useEditor,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "@tiptap/markdown";
import { EditorState } from "@tiptap/pm/state";
import { editTranscriptionNoteAction } from "@/app/(app)/transcription-actions";
import { useTranscription } from "@/lib/transcription/use-transcription";

// The unified dictation editor — one Tiptap surface for the whole lifecycle.
// While the mic is live it is read-only and the transcript streams in (the
// last, not-yet-finalised words show as italic "partial" text); on stop it
// becomes an editable Markdown note that auto-saves. Reopening a past
// dictation lands straight in the editable state.
//
// med-scribe's DictationEditor is the reference; its template-hint + section
// machinery is a deliberate follow-on and is intentionally not ported here.

// Carries the intake's microphone choice across the navigation to this page.
const DEVICE_KEY = "bizen:dictation:device";

type Phase = "recording" | "editing" | "voided";
type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Join finalised utterances into a single flowing string. */
function segmentsToText(segments: { text: string }[]): string {
  return segments
    .map((s) => s.text.trim())
    .filter(Boolean)
    .join(" ");
}

/** A one-paragraph doc: finalised text, plus any partial run in italic. */
function buildDoc(finalized: string, partialText: string | null): JSONContent {
  const content: JSONContent[] = [];
  if (finalized) content.push({ type: "text", text: finalized });
  if (partialText) {
    content.push({
      type: "text",
      marks: [{ type: "italic" }],
      text: (finalized ? " " : "") + partialText,
    });
  }
  return {
    type: "doc",
    content: [
      content.length ? { type: "paragraph", content } : { type: "paragraph" },
    ],
  };
}

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

export function DictationEditor({
  transcriptionId,
  templateId,
  templateName,
  initialNote,
  transcriptText,
  voided,
  autoRecord,
}: {
  transcriptionId: string;
  templateId: string | null;
  templateName: string | null;
  initialNote: string | null;
  transcriptText: string;
  voided: boolean;
  autoRecord: boolean;
}) {
  const { state, error, segments, partial, start, stop } = useTranscription();

  const [stopped, setStopped] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // `phase` is derived, not stored — it has no transition the user can't
  // express as "voided / recording done / still recording".
  const phase: Phase = voided
    ? "voided"
    : !autoRecord || stopped || state === "error"
      ? "editing"
      : "recording";

  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const seededRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      Placeholder.configure({
        placeholder: "Your dictated note will appear here…",
      }),
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

  // Save genuine user edits (programmatic setContent passes emitUpdate:false).
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
      { existingId: transcriptionId, deviceId },
    );
  }, [phase, start, templateId, transcriptionId]);

  // Seed the editor for a dictation opened straight into the editable state.
  useEffect(() => {
    if (!editor || seededRef.current || phase === "recording") return;
    seededRef.current = true;
    if (initialNote) {
      editor.commands.setContent(initialNote, {
        contentType: "markdown",
        emitUpdate: false,
      });
    } else if (transcriptText) {
      editor.commands.setContent(buildDoc(transcriptText, null), {
        emitUpdate: false,
      });
    }
    resetHistory(editor);
  }, [editor, phase, initialNote, transcriptText]);

  // Stream finalised + partial text into the editor while recording.
  useEffect(() => {
    if (!editor || phase !== "recording") return;
    editor.commands.setContent(
      buildDoc(segmentsToText(segments), partial?.text ?? null),
      { emitUpdate: false },
    );
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
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

  const recording = state === "starting" || state === "recording";

  async function handleStop() {
    const result = await stop();
    if (editor) {
      const finalText = result
        ? segmentsToText(result.segments)
        : segmentsToText(segments);
      editor.commands.setContent(buildDoc(finalText, null), {
        emitUpdate: false,
      });
      resetHistory(editor);
      void doSave(editor.getMarkdown());
    }
    setStopped(true);
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
              recording
                ? "animate-pulse bg-red-500"
                : "bg-zinc-200 dark:bg-zinc-700",
            )}
          />
          <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-zinc-400 uppercase dark:text-zinc-500">
            {recording ? "Recording" : voided ? "Deleted" : "Note"}
          </span>
        </span>

        {recording ? (
          <button
            type="button"
            onClick={() => void handleStop()}
            disabled={state === "starting"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3.5 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            <StopIcon aria-hidden="true" className="size-4" />
            {state === "starting" ? "Starting…" : "Stop"}
          </button>
        ) : (
          <span className="font-mono text-[10px] tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
            {saveLabel(saveStatus)}
          </span>
        )}
      </div>

      {/* Note format */}
      <p className="flex items-center gap-1.5 px-6 pt-2 font-mono text-[11px] tracking-wide text-zinc-400 sm:px-8 dark:text-zinc-500">
        <TemplateGlyph aria-hidden="true" className="size-3.5" />
        {templateName ?? "Free-form dictation"}
      </p>

      {error ? (
        <p className="mx-6 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:mx-8 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {error}
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
