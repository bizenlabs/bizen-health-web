"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeftIcon,
  InformationCircleIcon,
  MicrophoneIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
  UserIcon,
  UserPlusIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import {
  BetweenHorizontalEnd,
  BetweenVerticalEnd,
  Bold,
  Check,
  Columns3,
  Copy,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  type LucideIcon,
  Redo2,
  Rows3,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
  Wand2,
} from "lucide-react";
import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import clsx from "clsx";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import { Markdown } from "@tiptap/markdown";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import type { Mark } from "@tiptap/pm/model";
import { cellAround, goToNextCell, TableMap } from "@tiptap/pm/tables";
import { TableExtensions } from "@/lib/editor/table";
import {
  editTranscriptionNoteAction,
  reopenTranscriptionAction,
  setTranscriptionPatientAction,
} from "@/app/(app)/transcription-actions";
import { PatientPicker } from "@/components/patient-picker";
import { patientMeta } from "@/lib/patient-display";
import type { PatientSummary } from "@/lib/patients";
import {
  containsKnownVariable,
  type OrgVarSource,
  type PatientVarSource,
  patientVarsFromSummary,
  resolveTemplateVariables,
} from "@/lib/template-variables";
import type { TranscriptionMode } from "@/lib/transcriptions";
import {
  type LiveSegment,
  useTranscription,
} from "@/lib/transcription/use-transcription";
import {
  type AudioInputDevice,
  useAudioDevices,
} from "@/lib/transcription/use-audio-devices";
import { DictationDeleteButton } from "./dictation-delete-button";
import { DictationExportMenu, type ExportOrg } from "./dictation-export-menu";
import { DictationTitle } from "./dictation-title";
import { DictationCaret, dictationCaretKey } from "./dictation-caret";
import { DictationVariableGhost } from "./dictation-variable-ghost";
import { EditorLineRuler } from "./editor-line-ruler";
import { EmptySectionDimmer } from "./empty-section-dimmer";
import {
  applyTableCellPlaceholders,
  buildPlaceholderFn,
  cleanTemplateForEditor,
  findFirstEmptyTextblock,
  insertHintNodes,
  normalizeLabel,
  type TemplateHint,
} from "./template-hints";
import {
  parseUtterance,
  type VoiceCommand,
  type VoiceOp,
} from "@/lib/transcription/voice-commands";
import {
  applyCompiledDictionary,
  compileDictionary,
  type DictionaryRule,
} from "@/lib/transcription/dictionary-replace";
import { useDictionary } from "@/lib/transcription/use-dictionary";

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
// Persisted voice-command preferences (per browser).
const VOICE_COMMANDS_KEY = "bizen:dictation:voiceCommands";
const PUNCTUATION_KEY = "bizen:dictation:spokenPunctuation";

// Read a persisted boolean preference. Returns `fallback` on the server (no
// localStorage) and when nothing is stored — the toggles only drive a control
// that's rendered client-side while recording, so there's no hydration mismatch.
function readStoredBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

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

// Fill any {{...}} template variables still present in the document against the
// given patient. Used when a patient is linked or changed after the scaffold has
// already been seeded — known fields are substituted, a linked-but-empty field's
// marker is dropped, and `patient.*` markers are left untouched when there is no
// patient yet (see resolveTemplateVariables). Walks text nodes and rewrites only
// those that change, applying high-to-low so earlier positions stay valid.
function resolvePatientVariables(
  editor: Editor,
  source: PatientVarSource | null,
  now: Date,
): void {
  const edits: {
    from: number;
    to: number;
    text: string;
    marks: readonly Mark[];
  }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text || !node.text.includes("{{")) return;
    const resolved = resolveTemplateVariables(node.text, {
      patient: source,
      now,
    });
    if (resolved !== node.text) {
      edits.push({
        from: pos,
        to: pos + node.text.length,
        text: resolved,
        marks: node.marks,
      });
    }
  });
  if (edits.length === 0) return;
  const tr = editor.state.tr;
  for (let i = edits.length - 1; i >= 0; i--) {
    const e = edits[i];
    if (e.text === "") tr.delete(e.from, e.to);
    else tr.replaceWith(e.from, e.to, editor.schema.text(e.text, e.marks));
  }
  editor.view.dispatch(tr);
}

/** Text of the nearest heading at or above `pos` — the section `pos` sits in. */
function sectionLabelAt(editor: Editor, pos: number): string | null {
  let label: string | null = null;
  editor.state.doc.descendants((node, nodePos) => {
    // Headings appear in document order, so the last one before `pos` is the
    // nearest preceding section. Stop descending into nodes past `pos`.
    if (nodePos >= pos) return false;
    if (node.type.name === "heading") {
      const text = node.textContent.trim();
      if (text) label = text;
    }
    return true;
  });
  return label;
}

// --- Section navigation (for "next section" / "go to <name>" commands) -----
//
// Sections are delimited by top-level Markdown headings — the same definition
// `sectionLabelAt` uses to drive the "Dictating into <section>" strip, so voice
// navigation and the on-screen label stay consistent. (Templates that label
// sections with bold paragraphs rather than headings aren't navigable — a
// pre-existing limitation of the heading-based section model.)

interface SectionHeading {
  offset: number;
  nodeSize: number;
  text: string;
}

function sectionHeadings(editor: Editor): SectionHeading[] {
  const out: SectionHeading[] = [];
  editor.state.doc.forEach((node, offset) => {
    if (node.type.name === "heading") {
      out.push({
        offset,
        nodeSize: node.nodeSize,
        text: node.textContent.trim(),
      });
    }
  });
  return out;
}

/** Index of the section `pos` sits in, or -1 if it's before the first heading. */
function currentSectionIndex(headings: SectionHeading[], pos: number): number {
  let idx = -1;
  for (let i = 0; i < headings.length; i++) {
    if (headings[i].offset < pos) idx = i;
    else break;
  }
  return idx;
}

/** Where dictation should land within a section: its first empty block, else
 *  its first block, else just inside the heading line. */
function sectionInsertPos(
  editor: Editor,
  index: number,
  headings: SectionHeading[],
): number {
  const h = headings[index];
  const from = h.offset + h.nodeSize;
  const until = headings[index + 1]?.offset ?? editor.state.doc.content.size;
  let firstAny: number | null = null;
  let firstEmpty: number | null = null;
  editor.state.doc.forEach((node, offset) => {
    if (offset < from || offset >= until) return;
    if (node.isTextblock) {
      if (firstAny === null) firstAny = offset + 1;
      if (firstEmpty === null && node.content.size === 0)
        firstEmpty = offset + 1;
    }
  });
  const pos = firstEmpty ?? firstAny;
  if (pos !== null) return pos;
  // No block between this heading and the next — land at the heading's end.
  const max = Math.max(1, editor.state.doc.content.size - 1);
  return Math.min(h.offset + h.nodeSize - 1, max);
}

function findNextSectionPos(editor: Editor, pos: number): number | null {
  const hs = sectionHeadings(editor);
  if (!hs.length) return null;
  const next = currentSectionIndex(hs, pos) + 1;
  return next < hs.length ? sectionInsertPos(editor, next, hs) : null;
}

function findPrevSectionPos(editor: Editor, pos: number): number | null {
  const hs = sectionHeadings(editor);
  if (!hs.length) return null;
  const prev = currentSectionIndex(hs, pos) - 1;
  return prev >= 0 ? sectionInsertPos(editor, prev, hs) : null;
}

/** Canonical form for matching a spoken section name to a heading. */
function canonLabel(text: string): string {
  return normalizeLabel(text)
    .toLowerCase()
    .replace(/[:.]+$/, "")
    .trim();
}

/** Best-matching section for a spoken name: exact → substring → token overlap. */
function findSectionByName(editor: Editor, target: string): number | null {
  const hs = sectionHeadings(editor);
  if (!hs.length) return null;
  const want = canonLabel(target);
  if (!want) return null;

  let best = hs.findIndex((h) => canonLabel(h.text) === want);
  if (best < 0) {
    best = hs.findIndex((h) => {
      const c = canonLabel(h.text);
      return c.length > 0 && (c.includes(want) || want.includes(c));
    });
  }
  if (best < 0) {
    const wantWords = new Set(want.split(/\s+/).filter(Boolean));
    let bestScore = 0;
    hs.forEach((h, i) => {
      const overlap = canonLabel(h.text)
        .split(/\s+/)
        .filter((w) => wantWords.has(w)).length;
      if (overlap > bestScore) {
        bestScore = overlap;
        best = i;
      }
    });
    if (bestScore === 0) best = -1;
  }

  return best >= 0 ? sectionInsertPos(editor, best, hs) : null;
}

// --- Table cell navigation (for the table voice commands) ------------------
//
// prosemirror-tables ships horizontal cell movement (goToNextCell) but no
// vertical move, so this computes the target cell via TableMap — the same map
// goToNextCell uses internally — and drops a text selection into it. The
// dictation point is then resynced from that selection by the caller.
//
// Moves `rowDelta` rows from the cell the current selection sits in, keeping the
// same column unless `targetCol` is given ("next row" pins column 0). Returns
// false when the selection isn't in a table or the target row is out of bounds.
function moveToCell(
  editor: Editor,
  rowDelta: number,
  targetCol: number | null = null,
): boolean {
  const { state, view } = editor;
  const $cell = cellAround(state.selection.$from);
  if (!$cell) return false;
  const table = $cell.node(-1);
  const tableStart = $cell.start(-1);
  const map = TableMap.get(table);
  const rect = map.findCell($cell.pos - tableStart);
  const row = rect.top + rowDelta;
  if (row < 0 || row >= map.height) return false;
  const col = Math.min(targetCol ?? rect.left, map.width - 1);
  const offset = map.positionAt(row, col, table);
  const $target = state.doc.resolve(tableStart + offset);
  view.dispatch(
    state.tr.setSelection(TextSelection.near($target, 1)).scrollIntoView(),
  );
  return true;
}

// Assemble the document-letterhead branding from the org variable source: the
// name, then address lines, a phone·email contact line, website, tagline and a
// registration/tax line — the same detail block used on a clinic letterhead.
// Returns null when there's nothing to show, so exports stay unbranded.
function buildExportOrg(
  org: OrgVarSource | null,
  hasLogo: boolean,
): ExportOrg | null {
  if (!org) return null;
  const lines: string[] = [];
  if (org.address) {
    lines.push(
      ...org.address
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    );
  }
  const contact = [org.phone, org.email].filter(Boolean).join(" · ");
  if (contact) lines.push(contact);
  if (org.website) lines.push(org.website);
  if (org.tagline) lines.push(org.tagline);
  const ids = [
    org.registrationNo && `Reg: ${org.registrationNo}`,
    org.taxId && `GSTIN: ${org.taxId}`,
  ]
    .filter(Boolean)
    .join(" · ");
  if (ids) lines.push(ids);

  const name = org.name?.trim();
  // Nothing to brand with — no name, no detail lines, no logo.
  if (!name && lines.length === 0 && !hasLogo) return null;
  return { name: name || "", lines, hasLogo };
}

export function DictationEditor({
  transcriptionId,
  title,
  startedAtLabel,
  templateId,
  templateName,
  templateContent,
  mode,
  initialPatient,
  initialNote,
  transcriptText,
  initialSegments,
  voided,
  autoRecord,
  language,
  org,
  orgHasLogo,
}: {
  transcriptionId: string;
  // The dictation's name and a preformatted started-at timestamp — rendered in
  // the editor's own header so the recording controls sit inline with them.
  title: string | null;
  startedAtLabel: string;
  templateId: string | null;
  templateName: string | null;
  // The template's Markdown scaffold — shown above the transcript so the
  // clinician dictates into the structure. Null for a free-form dictation.
  templateContent: string | null;
  // Only DICTATION transcriptions allow (re)linking a patient here — an
  // encounter transcription's patient is fixed to its encounter.
  mode: TranscriptionMode;
  // The patient currently linked to this dictation, if any.
  initialPatient: PatientSummary | null;
  initialNote: string | null;
  transcriptText: string;
  // Finalised segments already on the session — seeded into a resumed
  // recording so it appends to the existing transcript.
  initialSegments: LiveSegment[];
  voided: boolean;
  autoRecord: boolean;
  // The tenant's transcription language/accent, resolved server-side.
  language: string;
  // The tenant's organization branding, resolved server-side — fills `{{org.*}}`
  // markers at seed time. Null only if branding couldn't be loaded.
  org: OrgVarSource | null;
  // Whether the tenant has uploaded a logo — drives the export letterhead.
  orgHasLogo: boolean;
}) {
  const router = useRouter();
  // Branding for the export letterhead — stable across the editor's lifetime.
  const exportOrg = buildExportOrg(org, orgHasLogo);
  const {
    state,
    error,
    segments,
    partial,
    start,
    pause,
    resume,
    switchDevice,
    stop,
    getLevel,
    isMuted,
  } = useTranscription();
  const { devices, selectedDeviceId, setSelectedDeviceId, hasLabels } =
    useAudioDevices();

  const [stopped, setStopped] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  // When the note was last persisted — drives the "Saved · 2m ago" timestamp.
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  // Whether the mic is muted at the source mid-recording (e.g. lid closed).
  const [micMuted, setMicMuted] = useState(false);
  // The linked patient — editable here for dictations (encounter mode is fixed).
  const [patient, setPatient] = useState<PatientSummary | null>(initialPatient);
  const [editingPatient, setEditingPatient] = useState(false);
  const [patientBusy, setPatientBusy] = useState(false);
  const [patientError, setPatientError] = useState<string | null>(null);
  // Shown after switching from one patient to another: already-filled variable
  // data is a point-in-time snapshot and is NOT rewritten on a patient change.
  const [variableChangeNotice, setVariableChangeNotice] = useState(false);
  // Which pane the review view shows once recording has stopped: the editable
  // note, or the read-only raw transcript.
  const [activeTab, setActiveTab] = useState<"note" | "transcript">("note");
  // The heading of the section dictation is currently landing in — shown while
  // recording so the clinician can see where the next utterances will go.
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Voice commands: spoken "new line", "next section", "scratch that", etc.
  // become structure/navigation/editing actions instead of literal text. On by
  // default; spoken punctuation is a separate opt-in since smart_format already
  // punctuates. Refs mirror the state so the streaming effect reads them without
  // a dependency.
  const [voiceCommandsOn, setVoiceCommandsOn] = useState(() =>
    readStoredBool(VOICE_COMMANDS_KEY, true),
  );
  const [punctuationOn, setPunctuationOn] = useState(() =>
    readStoredBool(PUNCTUATION_KEY, false),
  );
  const voiceCommandsOnRef = useRef(voiceCommandsOn);
  const punctuationOnRef = useRef(punctuationOn);
  // The clinic's custom dictionary: spoken forms feed Deepgram recognition
  // (keyterms, passed at start) and the written forms drive the replacement
  // pass on finalised text (dictRules, read by flushSegments).
  const { entries: dictEntries, keyterms: dictKeyterms } = useDictionary();
  const dictKeytermsRef = useRef<string[]>([]);
  const dictRulesRef = useRef<DictionaryRule[]>([]);
  // Transient "command fired" confirmation shown in the recording HUD.
  const [lastCommand, setLastCommand] = useState<{
    label: string;
    tone: "info" | "warn";
  } | null>(null);
  const commandClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Active-recording elapsed time — counts while the mic is live, freezes (not
  // resets) on pause, and resumes from where it left off.
  const elapsedMs = useElapsed(state === "recording");

  // Ticks only while a saved timestamp is on screen, so "Saved · 2m ago" ages
  // without a permanent interval.
  const now = useNow(saveStatus === "saved");

  // Reflect the mic carried over from intake (or a previous sitting) in the
  // picker once the browser hands back real device labels — but only if it's
  // still present. If it's gone (unplugged / different machine), the hook's
  // default stands, matching the capture layer's fallback to the default mic.
  const seededDeviceRef = useRef(false);
  useEffect(() => {
    if (seededDeviceRef.current || !hasLabels) return;
    seededDeviceRef.current = true;
    try {
      const saved = sessionStorage.getItem(DEVICE_KEY);
      if (saved && devices.some((d) => d.deviceId === saved)) {
        setSelectedDeviceId(saved);
      }
    } catch {
      /* sessionStorage unavailable */
    }
  }, [hasLabels, devices, setSelectedDeviceId]);

  // Pick a microphone from the editor. Persist it so the next sitting (Resume
  // remounts the page) starts on it, and — if recording right now — swap the
  // live session onto it without ending the dictation.
  const handleDeviceChange = useCallback(
    (deviceId: string) => {
      setSelectedDeviceId(deviceId);
      try {
        sessionStorage.setItem(DEVICE_KEY, deviceId);
      } catch {
        /* sessionStorage unavailable */
      }
      if (state === "recording" || state === "paused") {
        void switchDevice(deviceId);
      }
    },
    [setSelectedDeviceId, state, switchDevice],
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  // Flips true the first time the init effect seeds the editor — gates the
  // streaming effect so it doesn't run before insertPos is resolved.
  const initRef = useRef(false);
  // Whether the seeded scaffold carried any {{...}} variables — gates the
  // "patient changed, values not updated" notice so it never fires for a
  // template that has no variables.
  const hadVariablesRef = useRef(false);
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
  // Range of the most recently committed dictation run, so "scratch that" can
  // remove it. Cleared whenever a structural/navigation command moves the caret.
  const lastInsertRangeRef = useRef<{ from: number; to: number } | null>(null);

  // Strip the template's `[placeholder]` / `(instruction)` helper text out of
  // the seeded Markdown and extract the bracket hints. The hints are rendered
  // as non-editable placeholder ghost text (see `template-hints.ts`), never as
  // real content — so they can't be styled, partially overtyped, or saved.
  const { cleanedMarkdown, hints } = useMemo(
    () => cleanTemplateForEditor(templateContent ?? ""),
    [templateContent],
  );

  // Read hints from a ref so the Placeholder function (configured once below)
  // always sees the current set without re-creating the editor.
  const hintsRef = useRef<TemplateHint[]>(hints);
  useEffect(() => {
    hintsRef.current = hints;
  }, [hints]);

  // buildPlaceholderFn only closes over the ref — it reads `hintsRef.current`
  // lazily when the Placeholder extension invokes it, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [placeholderFn] = useState(() =>
    buildPlaceholderFn(hintsRef, "Your dictated note will appear here…"),
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Markdown,
      ...TableExtensions,
      EmptySectionDimmer,
      DictationCaret,
      DictationVariableGhost,
      Placeholder.configure({
        placeholder: placeholderFn,
        // Hints attach to every empty section node, not just the focused one,
        // and stay visible while the mic is live (the editor is read-only then).
        showOnlyCurrent: false,
        showOnlyWhenEditable: false,
        includeChildren: true,
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

  // Keep the dictation position refs glued to the document the same way the
  // caret decoration is (dictation-caret.ts maps its position through every
  // change). insertPos and the partial / last-insert ranges are plain refs, so
  // without this an out-of-band edit between ticks — e.g. an autosave-driven
  // setContent — would leave them pointing at moved content while the caret
  // moved correctly, the one way the tracked offset and the visible caret can
  // disagree. Mapping with the same -1 bias as the caret plugin makes them move
  // identically. Our own insert/delete transactions are mapped here too, but
  // the explicit selection.from resync after each insert is the final word, so
  // this only ever corrects positions we didn't author.
  useEffect(() => {
    if (!editor) return;
    const onTx = ({ transaction: tr }: { transaction: Transaction }) => {
      if (!tr.docChanged) return;
      const map = tr.mapping;
      if (insertPosRef.current !== null) {
        insertPosRef.current = map.map(insertPosRef.current, -1);
      }
      if (partialRangeRef.current) {
        const { from, length } = partialRangeRef.current;
        const mappedFrom = map.map(from, -1);
        partialRangeRef.current = {
          from: mappedFrom,
          length: map.map(from + length, 1) - mappedFrom,
        };
      }
      if (lastInsertRangeRef.current) {
        const { from, to } = lastInsertRangeRef.current;
        lastInsertRangeRef.current = {
          from: map.map(from, -1),
          to: map.map(to, 1),
        };
      }
    };
    editor.on("transaction", onTx);
    return () => {
      editor.off("transaction", onTx);
    };
  }, [editor]);

  // --- Persistence -----------------------------------------------------
  const doSave = useCallback(
    async (markdown: string) => {
      setSaveStatus("saving");
      const res = await editTranscriptionNoteAction(transcriptionId, markdown);
      if (res.ok) {
        setLastSavedAt(Date.now());
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    },
    [transcriptionId],
  );

  // Retry a failed save with the note's current content — the failed edit is
  // still in the editor, so re-saving picks it up.
  const handleRetrySave = useCallback(() => {
    if (editor) void doSave(editor.getMarkdown());
  }, [editor, doSave]);

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

  // Save genuine user edits — those made while editing, or while paused.
  // Programmatic stream inserts fire `update` too, but only during active
  // recording, which both checks gate out.
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      if (phase !== "editing" && !paused) return;
      scheduleSave(editor.getMarkdown());
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor, phase, paused, scheduleSave]);

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
      {
        existingId: transcriptionId,
        deviceId,
        seedSegments: initialSegments,
        keyterms: dictKeytermsRef.current,
        language,
      },
    );
  }, [phase, start, templateId, transcriptionId, initialSegments, language]);

  // --- One-shot init: seed the editor and place insertPos ---------------
  useEffect(() => {
    if (!editor || initRef.current) return;

    const transcriptBody = transcriptText?.trim() ?? "";
    // Seed hint slots only for a fresh template scaffold (no saved note yet).
    // A saved note is the clinician's own content and is loaded verbatim.
    const seedingTemplate = !initialNote && cleanedMarkdown.length > 0;

    // Fill {{...}} variables from the patient linked at open. With no patient
    // yet, patient.* markers are left for resolvePatientVariables to fill when
    // one is linked; date.today still resolves.
    const varCtx = {
      patient: patientVarsFromSummary(patient),
      org,
      now: new Date(),
    };
    hadVariablesRef.current =
      containsKnownVariable(cleanedMarkdown) ||
      containsKnownVariable(initialNote ?? "");

    if (initialNote) {
      // Clinician has a saved version of this note — load it as-is (a note saved
      // before a patient was linked may still carry unfilled markers).
      editor.commands.setContent(
        resolveTemplateVariables(initialNote, varCtx),
        {
          contentType: "markdown",
          emitUpdate: false,
        },
      );
    } else if (cleanedMarkdown) {
      // Seed the *cleaned* template scaffold — placeholders and instructions
      // stripped. The raw dictation is NOT dumped into the note; it's
      // available read-only in the Transcript tab.
      editor.commands.setContent(
        resolveTemplateVariables(cleanedMarkdown, varCtx),
        {
          contentType: "markdown",
          emitUpdate: false,
        },
      );
    } else if (transcriptBody) {
      // Free-form: the note *is* the transcript, so seed it directly.
      editor.commands.setContent(transcriptBody, {
        contentType: "markdown",
        emitUpdate: false,
      });
    }

    // Create the empty section nodes the extracted hints attach to, so each
    // section shows its guidance as non-editable placeholder ghost text — and
    // do the same for pure-[placeholder] table cells (empty cell + ghost hint).
    if (seedingTemplate) {
      insertHintNodes(editor, hints);
      applyTableCellPlaceholders(editor);
    }

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

    // 2. Templated: the first empty hint slot, else the first paragraph after
    //    the first heading.
    if (pos === null && seedingTemplate) {
      pos =
        findFirstEmptyTextblock(editor) ??
        findPositionAfterFirstHeading(editor);
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
  }, [
    editor,
    initialNote,
    cleanedMarkdown,
    hints,
    transcriptText,
    initialSegments,
    // Read once for seed-time variable fill; the initRef guard makes re-runs
    // (e.g. on a later patient relink) a no-op.
    patient,
    org,
  ]);

  // --- Voice commands ---------------------------------------------------
  // Keep the refs (read by the streaming effect) and localStorage in sync as
  // the toggles change. Initial values are hydrated via lazy useState above.
  useEffect(() => {
    voiceCommandsOnRef.current = voiceCommandsOn;
    try {
      localStorage.setItem(VOICE_COMMANDS_KEY, voiceCommandsOn ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [voiceCommandsOn]);
  // Keep the dictionary refs current as the async load resolves. flushSegments
  // and the start effect read these refs, so a load that finishes after
  // recording begins still applies replacement on subsequent utterances.
  useEffect(() => {
    dictKeytermsRef.current = dictKeyterms;
  }, [dictKeyterms]);
  useEffect(() => {
    dictRulesRef.current = compileDictionary(dictEntries);
  }, [dictEntries]);
  useEffect(() => {
    punctuationOnRef.current = punctuationOn;
    try {
      localStorage.setItem(PUNCTUATION_KEY, punctuationOn ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [punctuationOn]);
  useEffect(() => {
    return () => {
      if (commandClearTimer.current) clearTimeout(commandClearTimer.current);
    };
  }, []);

  // Flash a brief confirmation that a command fired. `warn` (amber) is for
  // removals/edge cases (scratch, undo, "already at last section").
  const flashCommand = useCallback(
    (label: string, tone: "info" | "warn" = "info") => {
      setLastCommand({ label, tone });
      if (commandClearTimer.current) clearTimeout(commandClearTimer.current);
      commandClearTimer.current = setTimeout(() => setLastCommand(null), 1800);
    },
    [],
  );

  // Insert a run of dictated text at insertPos, recording its range so a
  // following "scratch that" can remove exactly it.
  const insertText = useCallback(
    (text: string) => {
      if (!editor || insertPosRef.current === null || !text) return;
      const from = insertPosRef.current;
      const insert = (blockHasContent(editor, from) ? " " : "") + text;
      // Insert as a literal text node, never a raw string: a raw string can be
      // parsed as Markdown/HTML, so dictated speech like "1." or "- " would
      // restructure the doc. Then read the true post-insert position back from
      // the selection — ProseMirror positions are not string offsets, so
      // advancing by insert.length drifts (and compounds) whenever the doc
      // grows by a different amount than the characters inserted.
      editor.commands.insertContentAt(from, { type: "text", text: insert });
      const to = editor.state.selection.from;
      insertPosRef.current = to;
      lastInsertRangeRef.current = { from, to };
    },
    [editor],
  );

  // Map one parsed command onto a Tiptap/ProseMirror action.
  const applyVoiceCommand = useCallback(
    (command: VoiceCommand) => {
      if (!editor || insertPosRef.current === null) return;
      const docMax = () => Math.max(1, editor.state.doc.content.size - 1);
      switch (command.kind) {
        case "newline":
        case "paragraph": {
          const at = Math.min(Math.max(insertPosRef.current, 1), docMax());
          editor.chain().setTextSelection(at).splitBlock().run();
          insertPosRef.current = editor.state.selection.from;
          lastInsertRangeRef.current = null;
          flashCommand(
            command.kind === "paragraph" ? "New paragraph" : "New line",
          );
          break;
        }
        case "nextSection": {
          const pos = findNextSectionPos(editor, insertPosRef.current);
          if (pos !== null) {
            insertPosRef.current = pos;
            lastInsertRangeRef.current = null;
            const label = sectionLabelAt(editor, pos);
            flashCommand(label ? `→ ${label}` : "Next section");
          } else {
            flashCommand("Already at last section", "warn");
          }
          break;
        }
        case "prevSection": {
          const pos = findPrevSectionPos(editor, insertPosRef.current);
          if (pos !== null) {
            insertPosRef.current = pos;
            lastInsertRangeRef.current = null;
            const label = sectionLabelAt(editor, pos);
            flashCommand(label ? `→ ${label}` : "Previous section");
          } else {
            flashCommand("Already at first section", "warn");
          }
          break;
        }
        case "gotoSection": {
          const pos = findSectionByName(editor, command.target);
          if (pos !== null) {
            insertPosRef.current = pos;
            lastInsertRangeRef.current = null;
            const label = sectionLabelAt(editor, pos);
            flashCommand(label ? `→ ${label}` : `→ ${command.target}`);
          } else {
            // No section matched — don't swallow the words; treat as dictation.
            insertText(command.raw);
          }
          break;
        }
        case "scratchThat": {
          const r = lastInsertRangeRef.current;
          if (r) {
            editor.commands.deleteRange({ from: r.from, to: r.to });
            insertPosRef.current = r.from;
            lastInsertRangeRef.current = null;
            flashCommand("Scratched", "warn");
          } else {
            flashCommand("Nothing to scratch", "warn");
          }
          break;
        }
        case "undo": {
          editor.commands.undo();
          insertPosRef.current = Math.min(insertPosRef.current, docMax());
          lastInsertRangeRef.current = null;
          flashCommand("Undid", "warn");
          break;
        }
        // --- Table commands. Each seeds the selection at the dictation point,
        // runs a prosemirror-tables action, then resyncs insertPos from the
        // resulting selection. The editor is read-only while recording, so the
        // selection has to be placed before isActive("table") is meaningful.
        case "nextCell":
        case "prevCell": {
          const dir = command.kind === "nextCell" ? 1 : -1;
          const at = Math.min(Math.max(insertPosRef.current, 1), docMax());
          editor.commands.setTextSelection(at);
          if (!editor.isActive("table")) {
            flashCommand("Not in a table", "warn");
            break;
          }
          const moved = goToNextCell(dir)(editor.state, editor.view.dispatch);
          if (moved) {
            insertPosRef.current = editor.state.selection.from;
            lastInsertRangeRef.current = null;
            flashCommand(dir === 1 ? "Next cell" : "Previous cell");
          } else {
            flashCommand(dir === 1 ? "At last cell" : "At first cell", "warn");
          }
          break;
        }
        case "cellUp":
        case "cellDown": {
          const dir = command.kind === "cellDown" ? 1 : -1;
          const at = Math.min(Math.max(insertPosRef.current, 1), docMax());
          editor.commands.setTextSelection(at);
          if (!editor.isActive("table")) {
            flashCommand("Not in a table", "warn");
            break;
          }
          if (moveToCell(editor, dir)) {
            insertPosRef.current = editor.state.selection.from;
            lastInsertRangeRef.current = null;
            flashCommand(dir === 1 ? "Cell down" : "Cell up");
          } else {
            flashCommand(dir === 1 ? "At bottom row" : "At top row", "warn");
          }
          break;
        }
        case "nextRow": {
          const at = Math.min(Math.max(insertPosRef.current, 1), docMax());
          editor.commands.setTextSelection(at);
          if (!editor.isActive("table")) {
            flashCommand("Not in a table", "warn");
            break;
          }
          if (moveToCell(editor, 1, 0)) {
            flashCommand("Next row");
          } else {
            // Last row — grow the table and drop into the new row's first cell.
            editor.commands.addRowAfter();
            moveToCell(editor, 1, 0);
            flashCommand("New row");
          }
          insertPosRef.current = editor.state.selection.from;
          lastInsertRangeRef.current = null;
          break;
        }
        case "addRow": {
          const at = Math.min(Math.max(insertPosRef.current, 1), docMax());
          editor.commands.setTextSelection(at);
          if (!editor.isActive("table")) {
            flashCommand("Not in a table", "warn");
            break;
          }
          editor.commands.addRowAfter();
          moveToCell(editor, 1);
          insertPosRef.current = editor.state.selection.from;
          lastInsertRangeRef.current = null;
          flashCommand("Row added");
          break;
        }
        case "addColumn": {
          const at = Math.min(Math.max(insertPosRef.current, 1), docMax());
          editor.commands.setTextSelection(at);
          if (!editor.isActive("table")) {
            flashCommand("Not in a table", "warn");
            break;
          }
          editor.commands.addColumnAfter();
          goToNextCell(1)(editor.state, editor.view.dispatch);
          insertPosRef.current = editor.state.selection.from;
          lastInsertRangeRef.current = null;
          flashCommand("Column added");
          break;
        }
        case "deleteRow":
        case "deleteColumn": {
          const at = Math.min(Math.max(insertPosRef.current, 1), docMax());
          editor.commands.setTextSelection(at);
          if (!editor.isActive("table")) {
            flashCommand("Not in a table", "warn");
            break;
          }
          if (command.kind === "deleteRow") editor.commands.deleteRow();
          else editor.commands.deleteColumn();
          insertPosRef.current = Math.min(
            editor.state.selection.from,
            docMax(),
          );
          lastInsertRangeRef.current = null;
          flashCommand(
            command.kind === "deleteRow" ? "Row deleted" : "Column deleted",
            "warn",
          );
          break;
        }
      }
    },
    [editor, insertText, flashCommand],
  );

  // Process newly-finalised utterances: parse each into ops, then insert text
  // or run commands in order. Shared by the streaming effect and handleStop so a
  // command spoken right before Stop is honoured, not dumped as literal text.
  const flushSegments = useCallback(
    (segs: { text: string }[]) => {
      if (!editor || insertPosRef.current === null) return;
      for (const seg of segs) {
        const ops: VoiceOp[] = voiceCommandsOnRef.current
          ? parseUtterance(seg.text, { punctuation: punctuationOnRef.current })
          : [{ type: "text", text: seg.text.trim() }];
        for (const op of ops) {
          if (op.type === "text") {
            // Rewrite custom-dictionary terms ("BP" → "blood pressure") before
            // inserting. A no-op when the dictionary has no replacement rules.
            insertText(applyCompiledDictionary(op.text, dictRulesRef.current));
          } else {
            applyVoiceCommand(op.command);
          }
        }
      }
    },
    [editor, insertText, applyVoiceCommand],
  );

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

    // Insert anything newly finalised at insertPos (running any voice commands
    // it carries), advancing insertPos past it for the next chunk.
    if (segments.length > processedSegCountRef.current) {
      const newSegs = segments.slice(processedSegCountRef.current);
      processedSegCountRef.current = segments.length;
      flushSegments(newSegs);
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
      // Record the real inserted span (doc-position delta), not the string
      // length, so the next tick deletes exactly this partial.
      partialRangeRef.current = {
        from,
        length: editor.state.selection.from - from,
      };
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
  }, [editor, phase, segments, partial, flushSegments]);

  // Track which section the insertion point sits in so the status strip can
  // show "Dictating into <section>". Runs after the stream effect above has
  // advanced insertPos (same deps, declared later → fires after it), and on
  // pause, where the caret can be repositioned to redirect the next utterances.
  useEffect(() => {
    if (!editor || phase !== "recording" || insertPosRef.current === null) {
      return;
    }
    const label = sectionLabelAt(editor, insertPosRef.current);
    setActiveSection((prev) => (prev === label ? prev : label));
  }, [editor, phase, paused, segments, partial]);

  // Show a blinking caret at the live insertion point while the mic is running
  // (the editor is read-only then, so there's no native caret). Hidden while
  // paused/editing, where the editor is editable and shows its own caret. Same
  // deps as the section tracker so it picks up every insertPos advance — the
  // stream effect above has already moved it by the time this runs.
  useEffect(() => {
    if (!editor) return;
    const show = phase === "recording" && !paused;
    const pos = show ? insertPosRef.current : null;
    if (dictationCaretKey.getState(editor.state) === pos) return;
    editor.view.dispatch(editor.state.tr.setMeta(dictationCaretKey, pos));
  }, [editor, phase, paused, segments, partial]);

  // Editable while editing, and while *paused* — a paused session mutes the
  // mic, so manual edits and cursor moves are safe and can't collide with the
  // (stopped) stream. Only an actively recording editor stays read-only. The
  // `false` suppresses the update event — toggling editable is not a content
  // change and must not trip the auto-save.
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(phase === "editing" || paused, false);
  }, [editor, phase, paused]);

  // On pause, drop the caret at the live insertion point and focus, so the
  // clinician can read from where dictation left off — and reposition it to
  // redirect where the next utterances land once they resume.
  useEffect(() => {
    if (!editor || !paused || insertPosRef.current === null) return;
    const max = Math.max(1, editor.state.doc.content.size - 1);
    const safe = Math.min(Math.max(insertPosRef.current, 1), max);
    editor.chain().focus().setTextSelection(safe).run();
  }, [editor, paused]);

  // Warn before navigating away with work that would be lost: mid-recording
  // (audio can't be resumed), or with a note edit still in flight — either
  // inside the debounce/save window ("saving") or after a failed save
  // ("error"), both of which mean unpersisted changes.
  const hasUnsavedWork =
    phase === "recording" || saveStatus === "saving" || saveStatus === "error";
  useEffect(() => {
    if (!hasUnsavedWork) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedWork]);

  const recording =
    state === "starting" || state === "recording" || state === "paused";

  // Poll the source-mute flag so a mic that goes silent while recording (lid
  // closed, OS-muted) surfaces in the HUD instead of a flat meter with no
  // explanation. Source-mute fires no useful events through the worklet path; a
  // 500 ms poll is plenty for a rare lid open/close, and setState only on
  // change keeps it from re-rendering every tick. Muted is meaningful only
  // while actively recording, so it reads false otherwise.
  useEffect(() => {
    const id = setInterval(() => {
      const muted = state === "recording" && isMuted();
      setMicMuted((prev) => (prev === muted ? prev : muted));
    }, 500);
    return () => clearInterval(id);
  }, [state, isMuted]);

  // The Note/Transcript tabs surface only once recording has stopped and there
  // is a raw transcript worth showing.
  const showTabs = !recording && transcriptText.trim().length > 0;

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
      // Insert anything finalised but not yet picked up by the stream effect —
      // including a trailing command (e.g. "next section") said just before Stop.
      const finalSegments = result?.segments ?? segments;
      if (
        finalSegments.length > processedSegCountRef.current &&
        insertPosRef.current !== null
      ) {
        const newSegs = finalSegments.slice(processedSegCountRef.current);
        processedSegCountRef.current = finalSegments.length;
        flushSegments(newSegs);
      }
      resetHistory(editor);
      void doSave(editor.getMarkdown());
    }
    setStopped(true);
  }

  // Resume a *paused* session (same session, mic un-muted — distinct from the
  // page-level reopen below). Persist any pending paused edit before the stream
  // resumes (so a debounced save can't capture transient streamed text), then
  // continue dictation from wherever the caret now sits.
  function handleSessionResume() {
    if (editor) {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        saveTimer.current = null;
        void doSave(editor.getMarkdown());
      }
      const max = Math.max(1, editor.state.doc.content.size - 1);
      const anchor = editor.state.selection.anchor;
      insertPosRef.current = Math.min(Math.max(anchor, 1), max);
      partialRangeRef.current = null;
    }
    resume();
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

  // Link, change, or clear the patient on this dictation. Persists immediately;
  // the local state only advances if the server accepts it.
  async function handleSetPatient(next: PatientSummary | null) {
    const prev = patient;
    setPatientBusy(true);
    setPatientError(null);
    const res = await setTranscriptionPatientAction(
      transcriptionId,
      next?.id ?? null,
    );
    setPatientBusy(false);
    if (res.ok) {
      setPatient(next);
      setEditingPatient(false);
      // Fill any variables the scaffold seeded before this patient was linked.
      if (editor && next) {
        resolvePatientVariables(
          editor,
          patientVarsFromSummary(next),
          new Date(),
        );
      }
      // Switching between two different patients: variable data already filled
      // from the previous patient is a point-in-time snapshot and is NOT
      // rewritten — warn so the clinician updates those fields manually.
      if (hadVariablesRef.current && prev && next && prev.id !== next.id) {
        setVariableChangeNotice(true);
      }
    } else {
      setPatientError(res.error);
    }
  }

  // Dictations can be (re)linked to a patient; encounter transcripts are fixed.
  // Voided records are read-only.
  const canLinkPatient = mode === "DICTATION" && !voided;

  return (
    <div className="flex flex-col">
      {/* Sticky chrome — keep the lifecycle controls (Stop/Pause/Resume/Delete),
          the recording HUD, banners, tabs and the formatting toolbar pinned to
          the top so they stay reachable however long the note grows; only the
          note body below scrolls under it. */}
      <div className="sticky top-0 z-20 bg-white dark:bg-zinc-900">
        {voided ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            This dictation has been deleted — it is read-only.
          </p>
        ) : null}

        {/* Page header — dictation name and the recording controls share one
          line, with the timestamp beneath. */}
        <header className="shrink-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <Link
                href="/dictation"
                className="inline-flex items-center gap-1 font-mono text-[11px] font-medium tracking-[0.15em] text-zinc-400 uppercase transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
              >
                <ChevronLeftIcon className="size-3.5" />
                Dictation
              </Link>
              <DictationTitle
                transcriptionId={transcriptionId}
                title={title}
                fallbackLabel={templateName ?? "Free-form dictation"}
                editable={!voided}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:gap-3">
              {recording ? (
                <>
                  <LevelMeter
                    getLevel={getLevel}
                    active={state === "recording"}
                  />
                  <MicPicker
                    devices={devices}
                    selectedDeviceId={selectedDeviceId}
                    hasLabels={hasLabels}
                    onChange={handleDeviceChange}
                    disabled={state === "starting"}
                    showSingle
                  />
                  <VoiceCommandControl
                    enabled={voiceCommandsOn}
                    onToggle={() => setVoiceCommandsOn((v) => !v)}
                    punctuation={punctuationOn}
                    onTogglePunctuation={() => setPunctuationOn((v) => !v)}
                  />
                  {paused ? (
                    <button
                      type="button"
                      onClick={handleSessionResume}
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
                  {/* Stop ends recording — a soft red outline, the familiar
                    stop-recording cue. (Distinct from Delete, which is a filled
                    destructive control.) */}
                  <button
                    type="button"
                    onClick={() => void handleStop()}
                    disabled={state === "starting"}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3.5 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    <StopIcon aria-hidden="true" className="size-4" />
                    {state === "starting" ? "Starting…" : "Stop"}
                  </button>
                </>
              ) : phase === "editing" ? (
                <>
                  <MicPicker
                    devices={devices}
                    selectedDeviceId={selectedDeviceId}
                    hasLabels={hasLabels}
                    onChange={handleDeviceChange}
                    disabled={resuming}
                  />
                  <button
                    type="button"
                    onClick={() => void handleResume()}
                    disabled={resuming}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3.5 py-1.5 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                  >
                    <MicrophoneIcon aria-hidden="true" className="size-4" />
                    {resuming ? "Resuming…" : "Resume"}
                  </button>
                </>
              ) : null}

              {/* No delete control mid-recording — the session must be stopped
                first; afterwards it can be deleted (and restored) freely. */}
              {recording ? null : (
                <DictationDeleteButton
                  transcriptionId={transcriptionId}
                  voided={voided}
                />
              )}
            </div>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {startedAtLabel}
          </p>

          {/* Linked patient — a chip when one is linked (with Change/Remove for
              editable dictations), or a "Link patient" affordance when none. */}
          {patient || canLinkPatient ? (
            <div className="mt-2">
              {editingPatient ? (
                <div className="flex max-w-sm items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <PatientPicker
                      value={null}
                      onChange={(p) => void handleSetPatient(p)}
                      busy={patientBusy}
                      autoFocus
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPatient(false);
                      setPatientError(null);
                    }}
                    className="shrink-0 text-xs font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    Cancel
                  </button>
                </div>
              ) : patient ? (
                <div className="inline-flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                  <UserIcon
                    aria-hidden="true"
                    className="size-3.5 text-zinc-400 dark:text-zinc-500"
                  />
                  <span className="font-medium">{patient.preferredName}</span>
                  {patientMeta(patient) ? (
                    <span className="font-mono text-[10px] tracking-wide text-zinc-400 dark:text-zinc-500">
                      {patientMeta(patient)}
                    </span>
                  ) : null}
                  {canLinkPatient ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditingPatient(true)}
                        className="ml-1 font-medium text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
                      >
                        Change
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSetPatient(null)}
                        disabled={patientBusy}
                        className="font-medium text-zinc-400 hover:text-zinc-700 disabled:opacity-40 dark:text-zinc-500 dark:hover:text-zinc-300"
                      >
                        Remove
                      </button>
                    </>
                  ) : null}
                </div>
              ) : canLinkPatient ? (
                <button
                  type="button"
                  onClick={() => setEditingPatient(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-500 transition-colors hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200"
                >
                  <UserPlusIcon aria-hidden="true" className="size-3.5" />
                  Link patient
                </button>
              ) : null}
              {patientError ? (
                <span className="ml-2 text-xs text-red-600 dark:text-red-400">
                  {patientError}
                </span>
              ) : null}
            </div>
          ) : null}
        </header>

        {/* Patient-changed notice: filled variable data is a snapshot and isn't
            rewritten on a patient switch. */}
        {variableChangeNotice ? (
          <div
            role="status"
            className="mt-3 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-200"
          >
            <InformationCircleIcon
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-blue-500 dark:text-blue-400"
            />
            <p className="flex-1">
              Patient changed. Details already filled from variables (name, age,
              etc.) reflect the previous patient and were not updated — please
              review and edit them manually.
            </p>
            <button
              type="button"
              onClick={() => setVariableChangeNotice(false)}
              aria-label="Dismiss"
              className="shrink-0 text-blue-500 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
            >
              <XMarkIcon className="size-4" />
            </button>
          </div>
        ) : null}

        {/* Divider between the header and the note surface */}
        <hr className="mt-3 border-t border-zinc-200 dark:border-zinc-800" />

        {/* Recording HUD — shown only while the mic session is live. The editing
          view has no equivalent strip: the Note/Transcript tabs convey the
          mode and the save status lives in the toolbar. */}
        {recording ? (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 pt-2"
          >
            <span
              aria-hidden="true"
              className={clsx(
                "size-1.5 rounded-full",
                paused
                  ? "bg-amber-500"
                  : micMuted
                    ? "bg-amber-500"
                    : "animate-pulse bg-red-500",
              )}
            />
            <span
              className={clsx(
                "font-mono text-[10px] font-medium tracking-[0.2em] uppercase",
                !paused && micMuted
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-zinc-400 dark:text-zinc-500",
              )}
            >
              {paused ? "Paused" : micMuted ? "No signal" : "Recording"}
            </span>
            <span
              aria-hidden="true"
              className="font-mono text-[10px] tracking-wide text-zinc-400 tabular-nums dark:text-zinc-500"
            >
              {formatDuration(elapsedMs)}
            </span>
            {activeSection ? (
              <span className="hidden items-center gap-1 text-[10px] tracking-wide text-zinc-400 sm:flex dark:text-zinc-500">
                <span aria-hidden="true">→</span>
                <span className="max-w-[12rem] truncate">{activeSection}</span>
              </span>
            ) : null}
            {lastCommand ? (
              <span
                className={clsx(
                  "ml-auto inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide",
                  lastCommand.tone === "warn"
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                )}
              >
                {lastCommand.label}
              </span>
            ) : null}
          </div>
        ) : null}

        {error || resumeError ? (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            {error ?? resumeError}
          </p>
        ) : null}

        {/* A failed auto-save is data-loss-adjacent for a clinical note, so it
          gets a visible banner with a retry — not just the quiet strip text.
          The edit is still in the editor; Retry re-sends the current content. */}
        {saveStatus === "error" ? (
          <div
            role="alert"
            className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
          >
            <span>
              Couldn&rsquo;t save your note. Your changes are still here — retry
              to save them.
            </span>
            <button
              type="button"
              onClick={handleRetrySave}
              className="shrink-0 rounded-md border border-red-300 px-2.5 py-1 font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-900/40"
            >
              Retry
            </button>
          </div>
        ) : null}

        {/* Note / Transcript tabs — only after recording has stopped */}
        {showTabs ? (
          <div
            role="tablist"
            className="mt-3 flex gap-x-6 border-b border-zinc-200 text-sm font-semibold dark:border-zinc-800"
          >
            <TabBtn
              active={activeTab === "note"}
              onClick={() => setActiveTab("note")}
            >
              Note
            </TabBtn>
            <TabBtn
              active={activeTab === "transcript"}
              onClick={() => setActiveTab("transcript")}
            >
              Transcript
            </TabBtn>
          </div>
        ) : null}

        {/* Toolbar — editable note view only (editing or paused) */}
        {(phase === "editing" || paused) && editor && activeTab === "note" ? (
          <Toolbar
            editor={editor}
            documentTitle={title ?? templateName ?? "Free-form dictation"}
            documentSubtitle={startedAtLabel}
            org={exportOrg}
            saveStatus={saveStatus}
            lastSavedAt={lastSavedAt}
            now={now}
          />
        ) : !showTabs ? (
          <div className="mt-3" />
        ) : null}
      </div>

      {/* Body — fills the remaining height, scrolls within. The editor stays
          mounted and is hidden on the Transcript tab so its state survives the
          switch; the raw transcript renders read-only alongside it. */}
      <div ref={scrollRef} className="pb-2">
        {editor ? (
          <>
            <div className={clsx(showTabs && activeTab !== "note" && "hidden")}>
              <EditorLineRuler
                editor={editor}
                editable={phase === "editing" || paused}
                allowVoice={phase === "editing"}
              >
                <EditorContent editor={editor} />
              </EditorLineRuler>
            </div>
            {showTabs && activeTab === "transcript" ? (
              <TranscriptPane text={transcriptText} />
            ) : null}
          </>
        ) : (
          <div className="h-24 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800/60" />
        )}
      </div>
    </div>
  );
}

// A single Note/Transcript tab. Local state, not routing — so styled inline
// rather than reusing the route-based SettingsTabs.
function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={clsx(
        "-mb-px border-b-2 py-2.5 whitespace-nowrap transition-colors",
        active
          ? "border-blue-500 text-zinc-950 dark:border-blue-400 dark:text-white"
          : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
      )}
    >
      {children}
    </button>
  );
}

// Read-only view of the raw, unedited dictation transcript.
function TranscriptPane({ text }: { text: string }) {
  const trimmed = text.trim();
  return (
    <div className="pt-4">
      <p className="mb-2 font-mono text-[10px] tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
        Raw transcript — unedited
      </p>
      {/* Framed so a short transcript reads as a contained block rather than a
          stray line floating in an empty pane. */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900/40">
        {trimmed ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">
            {trimmed}
          </p>
        ) : (
          <p className="text-sm text-zinc-400 italic dark:text-zinc-500">
            No transcript was captured for this dictation.
          </p>
        )}
      </div>
    </div>
  );
}

// The editor's microphone control. Mirrors the intake picker's gate: a real
// dropdown only once the browser has handed back labelled devices and there's
// more than one to choose between. During recording (`showSingle`) it still
// names the lone mic so the clinician can see which input is live; in the
// editing state a single unlabelled device shows nothing — Resume handles it.
function MicPicker({
  devices,
  selectedDeviceId,
  hasLabels,
  onChange,
  disabled = false,
  showSingle = false,
}: {
  devices: AudioInputDevice[];
  selectedDeviceId: string | null;
  hasLabels: boolean;
  onChange: (deviceId: string) => void;
  disabled?: boolean;
  showSingle?: boolean;
}) {
  const canPick = hasLabels && devices.length > 1;

  if (!canPick) {
    // `showSingle` (recording) always names the live input — falling back to a
    // generic label before the browser hands back device names — so the
    // clinician can always see which mic is hot. Outside recording, a lone
    // unlabelled device shows nothing (Resume handles mic selection).
    if (!showSingle) return null;
    return (
      <span className="flex max-w-[12rem] items-center gap-1.5 text-zinc-400 dark:text-zinc-500">
        <MicrophoneIcon aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate text-xs">
          {devices[0]?.label || "Default microphone"}
        </span>
      </span>
    );
  }

  return (
    // Sized to match the Resume/Delete buttons (px-3.5 py-1.5 text-sm, fixed
    // width) so the control row reads as one uniform set; the device name
    // truncates within the fixed width.
    <span className="flex w-36 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 dark:border-zinc-800 dark:bg-zinc-900">
      <MicrophoneIcon
        aria-hidden="true"
        className="size-4 shrink-0 text-zinc-400 dark:text-zinc-500"
      />
      <select
        aria-label="Microphone"
        value={selectedDeviceId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full min-w-0 truncate border-0 bg-transparent text-sm text-zinc-700 focus:outline-none disabled:opacity-50 dark:text-zinc-200"
      >
        {devices.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>
            {d.label || "Microphone"}
          </option>
        ))}
      </select>
    </span>
  );
}

// The voice-command control: a toggle for spoken commands plus a reference of
// the phrases it understands. Shown only while recording. Defaults on — the
// matching is whole-utterance for the risky commands, so false fires are rare —
// with spoken punctuation as a separate opt-in (smart_format already punctuates).
const COMMAND_REFERENCE: { group: string; phrases: string[] }[] = [
  { group: "Structure", phrases: ["new line", "new paragraph"] },
  {
    group: "Navigation",
    phrases: ["next section", "previous section", "go to <section>"],
  },
  { group: "Editing", phrases: ["scratch that", "undo"] },
  {
    group: "Table",
    phrases: [
      "next cell",
      "previous cell",
      "next row",
      "cell up",
      "cell down",
      "add row",
      "add column",
      "delete row",
      "delete column",
    ],
  },
];

function VoiceCommandControl({
  enabled,
  onToggle,
  punctuation,
  onTogglePunctuation,
}: {
  enabled: boolean;
  onToggle: () => void;
  punctuation: boolean;
  onTogglePunctuation: () => void;
}) {
  return (
    <Popover className="relative">
      <PopoverButton
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none",
          enabled
            ? "border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-950/40"
            : "border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900",
        )}
        title="Voice commands"
      >
        <Wand2 aria-hidden="true" className="size-4" />
        <span className="hidden sm:inline">Commands</span>
      </PopoverButton>
      <PopoverPanel
        anchor="bottom end"
        className="z-40 mt-1 w-64 rounded-xl border border-zinc-200 bg-white p-3 text-sm shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
      >
        <SettingSwitch
          label="Voice commands"
          checked={enabled}
          onChange={onToggle}
        />
        {enabled ? (
          <div className="mt-3 space-y-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
            {COMMAND_REFERENCE.map((g) => (
              <div key={g.group}>
                <p className="font-mono text-[10px] tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                  {g.group}
                </p>
                <ul className="mt-0.5 flex flex-wrap gap-1">
                  {g.phrases.map((p) => (
                    <li
                      key={p}
                      className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      “{p}”
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <SettingSwitch
            label="Spoken punctuation"
            checked={punctuation}
            onChange={onTogglePunctuation}
          />
          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            Say “period”, “comma”, etc. Off by default — auto-punctuation is
            already on.
          </p>
        </div>
      </PopoverPanel>
    </Popover>
  );
}

// A compact label + toggle row used inside the voice-command panel.
function SettingSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="font-medium text-zinc-700 dark:text-zinc-200">
        {label}
      </span>
      <span
        aria-hidden="true"
        className={clsx(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked
            ? "bg-blue-600 dark:bg-blue-500"
            : "bg-zinc-200 dark:bg-zinc-700",
        )}
      >
        <span
          className={clsx(
            "inline-block size-4 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

// A current timestamp that refreshes every 30s while `active`, for ageing a
// relative "… ago" label without a perpetual interval.
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function formatRelative(deltaMs: number): string {
  const s = Math.max(0, Math.round(deltaMs / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

// The auto-save status, in plain language. Errors are owned by the banner
// above, so here a failure is just a quiet red marker; success carries a
// relative timestamp so "saved" reads as a confirmed event, not a promise.
function SaveIndicator({
  status,
  lastSavedAt,
  now,
}: {
  status: SaveStatus;
  lastSavedAt: number | null;
  now: number;
}) {
  const base = "flex items-center gap-1 text-[11px] tracking-wide";
  if (status === "saving") {
    return (
      <span className={clsx(base, "text-zinc-400 dark:text-zinc-500")}>
        Saving…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className={clsx(base, "text-red-600 dark:text-red-400")}>
        Save failed
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className={clsx(base, "text-zinc-400 dark:text-zinc-500")}>
        <Check aria-hidden="true" className="size-3" />
        Saved
        {lastSavedAt !== null ? (
          // aria-hidden so the 30s relative-time tick isn't announced over and
          // over; "Saved" alone carries the meaning for assistive tech.
          <span aria-hidden="true">{` · ${formatRelative(now - lastSavedAt)}`}</span>
        ) : null}
      </span>
    );
  }
  return (
    <span className={clsx(base, "text-zinc-400 dark:text-zinc-500")}>
      Auto-save on
    </span>
  );
}

// Counts elapsed milliseconds while `running`, freezing (not resetting) when it
// flips false and continuing from there when it flips back — so a pause holds
// the clock and resume keeps counting.
function useElapsed(running: boolean): number {
  const [ms, setMs] = useState(0);
  const accRef = useRef(0);
  const sinceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!running) return;
    sinceRef.current = Date.now();
    const id = setInterval(() => {
      const since = sinceRef.current;
      setMs(accRef.current + (since !== null ? Date.now() - since : 0));
    }, 1000);
    return () => {
      clearInterval(id);
      if (sinceRef.current !== null) {
        accRef.current += Date.now() - sinceRef.current;
        sinceRef.current = null;
      }
      setMs(accRef.current);
    };
  }, [running]);
  return ms;
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Live input-loudness meter. Reads the smoothed RMS off `getLevel` each frame
// and lights bars imperatively — no per-frame React render. Goes dim when
// inactive (paused / starting), giving the clinician a quick "the mic is
// hearing me" signal that finalised text alone can't.
function LevelMeter({
  getLevel,
  active,
}: {
  getLevel: () => number;
  active: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const bars = Array.from(container.children) as HTMLElement[];
    if (!active) {
      bars.forEach((bar) => (bar.style.opacity = "0.2"));
      return;
    }
    let raf = 0;
    const tick = () => {
      // Speech RMS sits low (~0.02–0.15); scale so normal talking fills it.
      const lvl = Math.min(1, getLevel() * 6);
      bars.forEach((bar, i) => {
        const threshold = (i + 0.5) / bars.length;
        bar.style.opacity = lvl >= threshold ? "1" : "0.25";
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, getLevel]);

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="flex h-8 items-center gap-[3px] px-1"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-red-500 transition-opacity duration-75"
          style={{ height: `${6 + i * 3}px`, opacity: 0.2 }}
        />
      ))}
    </span>
  );
}

function Toolbar({
  editor,
  documentTitle,
  documentSubtitle,
  org,
  saveStatus,
  lastSavedAt,
  now,
}: {
  editor: Editor;
  documentTitle: string;
  documentSubtitle?: string;
  org: ExportOrg | null;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  now: number;
}) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(editor.getMarkdown());
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (e.g. insecure context) — silently no-op */
    }
  }, [editor]);

  // Display platform-appropriate shortcut hints in tooltips.
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iP(hone|ad|od)/.test(navigator.platform);
  const mod = isMac ? "⌘" : "Ctrl+";
  const shift = isMac ? "⇧" : "Shift+";
  const alt = isMac ? "⌥" : "Alt+";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-0.5 border-y border-zinc-100 bg-white py-1.5 dark:border-zinc-800/80 dark:bg-zinc-900">
      <ToolBtn
        icon={Bold}
        label="Bold"
        shortcut={`${mod}B`}
        align="left"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolBtn
        icon={Italic}
        label="Italic"
        shortcut={`${mod}I`}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolBtn
        icon={UnderlineIcon}
        label="Underline"
        shortcut={`${mod}U`}
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolSep />
      <ToolBtn
        icon={Heading1}
        label="Heading 1"
        shortcut={`${mod}${alt}1`}
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      />
      <ToolBtn
        icon={Heading2}
        label="Heading 2"
        shortcut={`${mod}${alt}2`}
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      />
      <ToolBtn
        icon={Heading3}
        label="Heading 3"
        shortcut={`${mod}${alt}3`}
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
      <ToolSep />
      <ToolBtn
        icon={List}
        label="Bullet list"
        shortcut={`${mod}${shift}8`}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolBtn
        icon={ListOrdered}
        label="Numbered list"
        shortcut={`${mod}${shift}7`}
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolSep />
      <ToolBtn
        icon={TableIcon}
        label="Insert table"
        active={editor.isActive("table")}
        onClick={() =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
        }
      />
      {editor.isActive("table") ? (
        <>
          <ToolBtn
            icon={BetweenHorizontalEnd}
            label="Add row"
            onClick={() => editor.chain().focus().addRowAfter().run()}
          />
          <ToolBtn
            icon={Rows3}
            label="Delete row"
            onClick={() => editor.chain().focus().deleteRow().run()}
          />
          <ToolBtn
            icon={BetweenVerticalEnd}
            label="Add column"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          />
          <ToolBtn
            icon={Columns3}
            label="Delete column"
            onClick={() => editor.chain().focus().deleteColumn().run()}
          />
          <ToolBtn
            icon={Trash2}
            label="Delete table"
            onClick={() => editor.chain().focus().deleteTable().run()}
          />
        </>
      ) : null}
      <ToolSep />
      <ToolBtn
        icon={Undo2}
        label="Undo"
        shortcut={`${mod}Z`}
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolBtn
        icon={Redo2}
        label="Redo"
        shortcut={`${mod}${shift}Z`}
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      />
      <div className="ml-auto flex items-center gap-2">
        {/* Auto-save status lives here — the toolbar is shown exactly when the
            note is editable, so this is where save state is meaningful. */}
        <span
          role="status"
          aria-live="polite"
          className="hidden sm:inline-flex"
        >
          <SaveIndicator
            status={saveStatus}
            lastSavedAt={lastSavedAt}
            now={now}
          />
        </span>
        <div className="flex items-center gap-0.5">
          <ToolBtn
            icon={copied ? Check : Copy}
            label={copied ? "Copied" : "Copy note"}
            align="right"
            active={copied}
            onClick={handleCopy}
          />
          <DictationExportMenu
            editor={editor}
            title={documentTitle}
            subtitle={documentSubtitle}
            org={org}
            disabled={editor.isEmpty}
          />
        </div>
      </div>
    </div>
  );
}

function ToolSep() {
  return <span className="mx-1 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />;
}

function ToolBtn({
  icon: Icon,
  label,
  shortcut,
  active = false,
  disabled = false,
  align = "center",
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  // Tooltip horizontal anchor. Edge buttons anchor to their own edge so the
  // bubble doesn't overhang the toolbar and get clipped by side containers.
  align?: "left" | "center" | "right";
  onClick: () => void;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={clsx(
          "flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-30",
          active
            ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-zinc-100"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
        )}
      >
        <Icon aria-hidden="true" className="size-4" strokeWidth={2.25} />
      </button>
      <span
        className={clsx(
          "pointer-events-none absolute bottom-full z-30 mb-1.5 flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100 dark:bg-zinc-700",
          align === "left" && "left-0",
          align === "center" && "left-1/2 -translate-x-1/2",
          align === "right" && "right-0",
        )}
      >
        {label}
        {shortcut ? (
          <kbd className="rounded border border-white/20 px-1 font-sans text-[10px] text-zinc-300">
            {shortcut}
          </kbd>
        ) : null}
      </span>
    </div>
  );
}
