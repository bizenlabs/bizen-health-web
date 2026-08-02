"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import clsx from "clsx";
import {
  Check,
  Loader2,
  Mic,
  Pencil,
  Plus,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
import type { DictionaryEntry } from "@/lib/dictionary";
import { useWordCapture } from "@/lib/transcription/use-word-capture";
import {
  createEntryAction,
  deleteEntryAction,
  type DictionaryActionResult,
  restoreEntryAction,
  retireEntryAction,
  updateEntryAction,
} from "../actions";

// Languages a clinic is likely to dictate in. Deepgram key-term prompting is
// language-aware; the value is stored on the entry and (today) labels the row.
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "mr", label: "Marathi" },
  { code: "bn", label: "Bengali" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
];

function languageLabel(code: string): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? code.toUpperCase();
}

export function DictionaryManager({ entries }: { entries: DictionaryEntry[] }) {
  const active = entries.filter((e) => !e.retired);
  const retired = entries.filter((e) => e.retired);
  const [showRetired, setShowRetired] = useState(false);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 py-2">
      <header>
        <h1 className="text-lg font-semibold text-zinc-950 dark:text-white">
          Vocabulary
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Add words your clinic uses so transcription spells them correctly —
          drug names, abbreviations, or local proper nouns. Give a written form
          to also expand shorthand as you dictate (say “BP”, write “blood
          pressure”). Shared across everyone at this clinic.
        </p>
      </header>

      <AddPanel />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Words{" "}
          <span className="font-normal text-zinc-400">({active.length})</span>
        </h2>
        {active.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 px-4 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            No words yet. Add one above to improve how it’s transcribed.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {active.map((entry) => (
              <EntryRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </section>

      {retired.length > 0 ? (
        <section className="space-y-3">
          <button
            type="button"
            onClick={() => setShowRetired((v) => !v)}
            className="text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {showRetired ? "Hide" : "Show"} removed words ({retired.length})
          </button>
          {showRetired ? (
            <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {retired.map((entry) => (
                <RetiredRow key={entry.id} entry={entry} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

// --- Add ------------------------------------------------------------------

function AddPanel() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <EntryForm
      submitLabel="Add word"
      onSubmit={async (fd) => {
        const res = await createEntryAction(fd);
        if (res.ok) {
          setError(null);
          router.refresh();
        } else {
          setError(res.error);
        }
        return res;
      }}
      resetOnSuccess
      error={error}
    />
  );
}

// --- A row, with inline edit ---------------------------------------------

function EntryRow({ entry }: { entry: DictionaryEntry }) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove() {
    startTransition(async () => {
      const res = await retireEntryAction(entry.id);
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  if (editing) {
    return (
      <li className="bg-zinc-50/60 p-4 dark:bg-zinc-900/40">
        <EntryForm
          submitLabel="Save"
          initial={entry}
          onCancel={() => {
            setEditing(false);
            setError(null);
          }}
          onSubmit={async (fd) => {
            const res = await updateEntryAction(entry.id, fd);
            if (res.ok) {
              setEditing(false);
              setError(null);
              router.refresh();
            } else {
              setError(res.error);
            }
            return res;
          }}
          error={error}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {entry.spokenForm}
          </span>
          {entry.writtenForm ? (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              → {entry.writtenForm}
            </span>
          ) : (
            <span className="text-xs text-zinc-400">recognition only</span>
          )}
        </div>
      </div>
      <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        {languageLabel(entry.language)}
      </span>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          label="Edit"
          onClick={() => setEditing(true)}
          disabled={pending}
        >
          <Pencil className="size-4" />
        </IconButton>
        <IconButton label="Remove" onClick={remove} disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
        </IconButton>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </li>
  );
}

function RetiredRow({ entry }: { entry: DictionaryEntry }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function act(fn: () => Promise<DictionaryActionResult>) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error);
    });
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3 text-zinc-400">
      <div className="min-w-0 flex-1">
        <span className="line-through">{entry.spokenForm}</span>
        {entry.writtenForm ? (
          <span className="ml-2 text-sm line-through">
            → {entry.writtenForm}
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <IconButton
          label="Restore"
          onClick={() => act(() => restoreEntryAction(entry.id))}
          disabled={pending}
        >
          <RotateCcw className="size-4" />
        </IconButton>
        <IconButton
          label="Delete permanently"
          onClick={() => act(() => deleteEntryAction(entry.id))}
          disabled={pending}
        >
          <Trash2 className="size-4" />
        </IconButton>
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </li>
  );
}

// --- Shared add/edit form -------------------------------------------------

function EntryForm({
  submitLabel,
  initial,
  onSubmit,
  onCancel,
  resetOnSuccess,
  error,
}: {
  submitLabel: string;
  initial?: DictionaryEntry;
  onSubmit: (fd: FormData) => Promise<DictionaryActionResult>;
  onCancel?: () => void;
  resetOnSuccess?: boolean;
  error: string | null;
}) {
  const [spokenForm, setSpokenForm] = useState(initial?.spokenForm ?? "");
  const [writtenForm, setWrittenForm] = useState(initial?.writtenForm ?? "");
  const [language, setLanguage] = useState(initial?.language ?? "en");
  const [pending, startTransition] = useTransition();
  const capture = useWordCapture();
  const recording = capture.state === "recording";

  async function toggleRecording() {
    if (recording) {
      const text = await capture.stop();
      if (text) setSpokenForm(text);
    } else {
      await capture.start();
    }
  }

  function submit() {
    if (!spokenForm.trim()) return;
    const fd = new FormData();
    fd.set("spokenForm", spokenForm.trim());
    fd.set("writtenForm", writtenForm.trim());
    fd.set("language", language);
    startTransition(async () => {
      const res = await onSubmit(fd);
      if (res.ok && resetOnSuccess) {
        setSpokenForm("");
        setWrittenForm("");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Field label="Word as spoken">
          <div className="flex items-center gap-1.5">
            <input
              value={recording ? capture.preview : spokenForm}
              onChange={(e) => setSpokenForm(e.target.value)}
              readOnly={recording}
              placeholder={recording ? "Listening…" : "e.g. BP"}
              className={inputClass}
            />
            <RecordButton recording={recording} onToggle={toggleRecording} />
          </div>
          {capture.error ? (
            <p className="text-xs text-red-600">
              Recording failed: {capture.error}
            </p>
          ) : null}
        </Field>
        <Field label="Written form (optional)">
          <input
            value={writtenForm}
            onChange={(e) => setWrittenForm(e.target.value)}
            placeholder="e.g. blood pressure"
            className={inputClass}
          />
        </Field>
        <Field label="Language">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className={inputClass}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || recording || !spokenForm.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : initial ? (
            <Check className="size-4" />
          ) : (
            <Plus className="size-4" />
          )}
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}

// Record-to-fill: speak a word, watch it appear in the field, edit, save. The
// capture hook lives in EntryForm so the live preview can render in the input.
function RecordButton({
  recording,
  onToggle,
}: {
  recording: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={recording ? "Stop and use what you said" : "Record a word"}
      aria-label={recording ? "Stop recording" : "Record a word"}
      className={clsx(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
        recording
          ? "animate-pulse border-red-300 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
          : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800",
      )}
    >
      {recording ? (
        <Square className="size-4 fill-current" />
      ) : (
        <Mic className="size-4" />
      )}
    </button>
  );
}

// --- Small UI primitives --------------------------------------------------

const inputClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="inline-flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      {children}
    </button>
  );
}
