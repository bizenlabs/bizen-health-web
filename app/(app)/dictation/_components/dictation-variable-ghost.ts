import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { isKnownVariable, variableLabel } from "@/lib/template-variables";

// Renders any *unresolved* {{variable}} marker still in the document as ghost
// text — the human label (e.g. "Patient name") in muted italics — instead of the
// raw `{{patient.name}}` syntax. Markers are unresolved only before a patient is
// linked; once one is, resolvePatientVariables (dictation-editor.tsx) replaces
// the underlying text with real data and these decorations vanish.
//
// Decoration-only: the literal token stays in the document (so it can still be
// resolved later); an inline decoration hides it and a widget draws the label in
// its place. Recomputed from the current doc on each view update, so it follows
// edits without manual position mapping.
const TOKEN = /\{\{\s*([\w.]+)\s*\}\}/g;

export const dictationVariableGhostKey = new PluginKey(
  "dictationVariableGhost",
);

export const dictationVariableGhostPlugin = new Plugin({
  key: dictationVariableGhostKey,
  props: {
    decorations(state) {
      const decos: Decoration[] = [];
      state.doc.descendants((node, pos) => {
        if (!node.isText || !node.text || !node.text.includes("{{")) return;
        const text = node.text;
        TOKEN.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = TOKEN.exec(text)) !== null) {
          const key = m[1].trim();
          if (!isKnownVariable(key)) continue;
          const from = pos + m.index;
          const to = from + m[0].length;
          const label = variableLabel(key);
          decos.push(
            // Hide the literal token text…
            Decoration.inline(from, to, { class: "dictation-var-hidden" }),
            // …and draw the label as ghost text in its place.
            Decoration.widget(
              from,
              () => {
                const span = document.createElement("span");
                span.className = "dictation-var-ghost";
                span.setAttribute("aria-hidden", "true");
                span.textContent = label;
                return span;
              },
              { side: -1, key: `var-${key}-${from}` },
            ),
          );
        }
      });
      return decos.length ? DecorationSet.create(state.doc, decos) : null;
    },
  },
});

export const DictationVariableGhost = Extension.create({
  name: "dictationVariableGhost",
  addProseMirrorPlugins() {
    return [dictationVariableGhostPlugin];
  },
});
