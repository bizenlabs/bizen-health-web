import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// A visible caret at the live dictation insertion point. While the mic is
// recording the editor is read-only (contenteditable=false), so ProseMirror
// renders no native caret — finalised text just appears at the tracked insert
// position. Without a marker the clinician can't see where the next words will
// land (especially before the first utterance, or between sections after a
// "next section" command). This draws a blinking caret widget at that position.
//
// Decoration-only: it never touches the document or saved Markdown. The
// position is pushed in from the editor component via a meta transaction (see
// dictation-editor.tsx) and mapped through intervening edits so it survives the
// stream's own insert/delete transactions between updates.
export const dictationCaretKey = new PluginKey<number | null>("dictationCaret");

// Exported so the position-tracking logic can be unit-tested against a bare
// EditorState (getSchema gives a schema but no plugins). The same instance is
// what the extension registers in the editor.
export const dictationCaretPlugin = new Plugin<number | null>({
  key: dictationCaretKey,
  state: {
    init: () => null,
    apply(tr, value) {
      const meta = tr.getMeta(dictationCaretKey);
      // An explicit set (a number to show, or null to hide) wins.
      if (meta !== undefined) return meta as number | null;
      // Otherwise keep the caret pinned to its spot across doc changes.
      return value == null ? value : tr.mapping.map(value, -1);
    },
  },
  props: {
    decorations(state) {
      const pos = dictationCaretKey.getState(state);
      if (pos == null) return null;
      const safe = Math.min(Math.max(pos, 0), state.doc.content.size);
      return DecorationSet.create(state.doc, [
        Decoration.widget(
          safe,
          () => {
            const span = document.createElement("span");
            span.className = "dictation-caret";
            span.setAttribute("aria-hidden", "true");
            return span;
          },
          // Stable key so the widget isn't torn down/recreated each tick;
          // side -1 keeps it just before following content.
          { key: "dictation-caret", side: -1 },
        ),
      ]);
    },
  },
});

export const DictationCaret = Extension.create({
  name: "dictationCaret",
  addProseMirrorPlugins() {
    return [dictationCaretPlugin];
  },
});
