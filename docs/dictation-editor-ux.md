# Dictation Editor — UX Improvement Checklist

Tracked findings from a UX review of the dictation editor, covering both the
source (`app/(app)/dictation/_components/dictation-editor.tsx`) and the live
staging UI across the **editing**, **transcript**, and **recording** states.

Status legend: `[ ]` open · `[~]` in progress · `[x]` done. Update the box and
add a short note (PR #, decision) when a line moves.

---

## Tier 1 — Recording trust (highest value)

Confirmed absent in the live recording shell. **All four done** — type-checks
and lints clean; visual verification still pending a live recording session
(mic + Deepgram, not reproducible headlessly).

- [x] **Elapsed-time timer while recording.** Added `useElapsed` (counts active
      recording, freezes on pause, resumes from where it left off) +
      `formatDuration`; rendered as `mm:ss` in the status strip next to
      "RECORDING".
- [x] **Live audio-level / VU meter.** `audio-capture.ts` now computes a
      smoothed RMS off each PCM frame and exposes `getLevel()` (surfaced through
      `useTranscription`); new `LevelMeter` lights bars via rAF (no per-frame
      render) beside the mic control while recording.
- [x] **Show the active mic name during recording.** `MicPicker` (showSingle)
      always names the live input while recording, falling back to "Default
      microphone" before labels resolve instead of rendering nothing.
- [x] **Surface the section-targeting feature.** `sectionLabelAt` derives the
      nearest heading above `insertPos`; the status strip shows
      "→ <section>" while recording. _Follow-up:_ the "Pause → click a section →
      Resume" hint text is not yet added.

## Tier 2 — Save integrity (clinical data safety)

**All three done** — type-checks and lints clean; visual verification still
pending (failed-save banner needs a forced save error to exercise).

- [x] **Extend the unsaved-edit guard beyond recording.** `beforeunload` now
      fires on `hasUnsavedWork` — recording **or** `saveStatus === "saving"`
      (covers the debounce window) **or** `"error"` — so an in-flight or failed
      note edit blocks navigation, not just recording.
- [x] **Make "Save failed" recoverable and visible.** A failed save now raises a
      `role="alert"` banner ("Your changes are still here — retry to save them")
      with a **Retry** button (`handleRetrySave` re-sends the editor's current
      content). The quiet strip text remains as a secondary cue.
- [x] **Clarify save-status wording.** New `SaveIndicator` replaces the terse
      `saveLabel`: "Saving…" / "Saved · 2m ago" (check icon + relative time via
      `useNow`/`formatRelative`) / "Auto-save on". `lastSavedAt` records each
      success; the status now shows in the paused state too, not just editing.

## Tier 3 — Clarity / correctness

**All three done.** #8 turned out to be a **frontend bug**, not a server-side
one — root-caused and fixed below. Type-checks and lints clean.

- [x] **Content ↔ label mismatch — root-caused & fixed (was a client bug).**
      The note auto-save called
      `editTranscriptionNoteAction(id, markdown, null)`, and
      `editTranscriptionNote` serialised `templateId: null` into the PATCH body
      — so **every save wiped the dictation's templateId**. On the next load
      `getTemplate` had no id, so a templated note labelled itself "Free-form
      dictation". Fix: `editTranscriptionNote` now PATCHes `noteContent` only;
      dropped the `templateId` param from the action and the `doSave` call.
      _Residual:_ dictations whose templateId was already wiped stay null in the
      DB — a one-off backfill/repair is out of scope here.
- [x] **Soften the active-toggle styling in the toolbar.** Active `ToolBtn`
      went from solid black (`bg-zinc-900`) to a subtle tint
      (`bg-zinc-200`/`dark:bg-zinc-700`) so an on-toggle no longer reads as a
      primary CTA.
- [x] **Restyle Stop as neutral, not red.** Stop is now a solid neutral/dark
      button (red reserved for Delete), keeping a small red stop glyph as the
      familiar recording cue.

## Tier 4 — Polish

- [ ] **Status strip left label should track the active tab.** It still reads
      "● NOTE" while viewing the Transcript tab
      (`dictation-editor.tsx:743-751`).
- [ ] **De-emphasize empty template sections.** The Procedure Note scaffold
      renders ~10 empty section headings; the clinician scrolls past a lot of
      blank structure. Consider collapsing/de-emphasizing empty sections.
- [ ] **Frame the raw transcript pane.** One short line sits atop ~600px of
      blank space (`TranscriptPane`, `dictation-editor.tsx:856-874`). A subtle
      card/indent would help.
- [ ] **Accessibility: announce state changes.** Recording→Paused, "Save
      failed", and the error banner aren't in `aria-live` regions; recording state
      is conveyed color-only. Wrap the status strip in `aria-live="polite"` and
      make save errors assertive.

---

## Suggested sequencing

1. Tier 1 (#1–#4) — recording trust.
2. Tier 2 (#5–#7) — save integrity, as one bundle.
3. Tier 3 #8 — verify the template-label bug.
4. Tier 3 #9–#10, then Tier 4 — styling and polish.
