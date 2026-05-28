import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Highlights template-authored helper texts so the editor renders them
// visually distinct from the clinician's actual content. Two patterns:
//
//   - `[Patient's primary reason for visit]` — square brackets, always a
//     placeholder. Clinicians don't normally use square brackets in notes,
//     so it's safe to dim every occurrence.
//   - `(Document in patient's own words when possible)` — parens that fill
//     an entire paragraph, treated as an instruction. Inline parentheticals
//     in mixed-content paragraphs (e.g. "BP 120/80 (normal)" or "(per
//     spouse)") are left alone so legitimate dictated content isn't dimmed.
//
// Implemented as ProseMirror decorations rather than marks, so the helper
// text is NOT modified — it stays in the doc and gets persisted into
// `note_content` until the clinician overtypes it.

const BRACKET_RE = /\[[^\[\]\n]+\]/g;
const PARENS_PARA_RE = /^\s*\([^()\n]+\)\s*$/;

function buildDecorations(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    // Whole-paragraph `(...)` — dim the entire content.
    if (node.type.name === "paragraph") {
      const trimmed = node.textContent.trim();
      if (trimmed && PARENS_PARA_RE.test(trimmed)) {
        decorations.push(
          Decoration.inline(pos + 1, pos + node.nodeSize - 1, {
            class: "template-hint",
          }),
        );
        return false;
      }
    }
    if (!node.isText || !node.text) return;
    for (const match of node.text.matchAll(BRACKET_RE)) {
      if (match.index === undefined) continue;
      const from = pos + match.index;
      const to = from + match[0].length;
      decorations.push(Decoration.inline(from, to, { class: "template-hint" }));
    }
  });

  return DecorationSet.create(doc, decorations);
}

const key = new PluginKey<DecorationSet>("templateHint");

export const TemplateHint = Extension.create({
  name: "templateHint",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init(_, { doc }) {
            return buildDecorations(doc);
          },
          apply(tr, old) {
            if (!tr.docChanged) return old;
            return buildDecorations(tr.doc);
          },
        },
        props: {
          decorations(state: EditorState) {
            return key.getState(state);
          },
        },
      }),
    ];
  },
});
