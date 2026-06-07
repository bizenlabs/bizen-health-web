# Dictation Editor — UX Improvement Checklist

Tracked findings from a UX review of the dictation editor, covering both the
source (`app/(app)/dictation/_components/dictation-editor.tsx`) and the live
staging UI across the **editing**, **transcript**, and **recording** states.

Status legend: `[ ]` open · `[~]` in progress · `[x]` done. Update the box and
add a short note (PR #, decision) when a line moves.

---

## Tier 1 — Recording trust (highest value)

Confirmed absent in the live recording shell.

- [ ] **Elapsed-time timer while recording.** Today recording shows only a
      pulsing red dot + "RECORDING" (status strip, `dictation-editor.tsx:731-752`).
      Add a running `mm:ss`. Most-expected affordance in any dictation tool.
- [ ] **Live audio-level / VU meter.** Nothing signals the mic is actually
      capturing — the #1 real-world dictation failure (dead/wrong mic). A small
      live level bar next to the mic control turns "is this on?" into instant
      confidence.
- [ ] **Show the active mic name during recording.** In the live recording
      state there was _no_ mic indicator — `MicPicker` renders nothing when the
      device is unlabeled/single (`dictation-editor.tsx:898-908`). A clinician
      mid-dictation can't confirm which input is live.
- [ ] **Surface the section-targeting feature.** Dictation correctly lands in
      the targeted section (`insertPosRef`, `dictation-editor.tsx:449-503`), but
      nothing tells the user _where_ the next words will go, and the editor is
      read-only while recording so they can't click to retarget. Add a
      "Dictating into: _<section>_" marker and a "Pause → click a section →
      Resume" hint.

## Tier 2 — Save integrity (clinical data safety)

- [ ] **Extend the unsaved-edit guard beyond recording.** `beforeunload` only
      fires during recording (`dictation-editor.tsx:526-531`). In editing,
      navigating away during the 1200ms debounce window or after a failed save
      silently loses the edit. Guard on `saveStatus === "saving" | "error"` too.
- [ ] **Make "Save failed" recoverable and visible.** It renders as ~10px gray
      uppercase mono in the far corner (`saveLabel`, `dictation-editor.tsx:759-763,
933-944`) with no retry path. Promote failures to a visible banner + a
      **Retry** action.
- [ ] **Clarify save-status wording.** "Auto-saves" reads as a promise, not a
      state. Use explicit states with an icon — "All changes saved ✓" ↔ "Saving…"
      ↔ "Unsaved changes" — ideally with a relative timestamp.

## Tier 3 — Clarity / correctness

- [ ] **Investigate content ↔ label mismatch (likely a bug, verify
      server-side).** Title + status strip showed "Free-form dictation" with the
      free-form glyph, but the body was a full **Procedure Note** template
      scaffold. `templateName` isn't reflected in the header/metadata. Confirm
      whether the template association failed to persist.
- [ ] **Soften the active-toggle styling in the toolbar.** The active state
      (`bg-zinc-900` solid black, `dictation-editor.tsx:1109-1114`) is far heavier
      than the ghost toolbar around it — on load, an active "Bold" reads like a
      primary CTA. Use a subtle tinted active state.
- [ ] **Restyle Stop as neutral, not red.** Stop is non-destructive (Resume /
      re-open afterward), so red mis-teaches "danger"
      (`dictation-editor.tsx:681-689`). Reserve red for Delete.

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
