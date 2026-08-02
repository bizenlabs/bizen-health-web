import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

// Dims template section headings whose section body is still empty, so a mostly
// unfilled scaffold doesn't read as a wall of equally-weighted headings. A
// section spans from its heading up to the next heading of the same or higher
// level; if nothing in that span has text, the heading is dimmed.
//
// Decoration-only: it never touches the document or the saved Markdown, recomputes
// on every change, and a section un-dims the moment any text lands in it.
export const EmptySectionDimmer = Extension.create({
  name: "emptySectionDimmer",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations(state) {
            const { doc } = state;
            const tops: { node: PMNode; offset: number }[] = [];
            doc.forEach((node, offset) => tops.push({ node, offset }));

            const decos: Decoration[] = [];
            for (let i = 0; i < tops.length; i++) {
              const { node, offset } = tops[i];
              if (node.type.name !== "heading") continue;
              const level = node.attrs.level as number;

              let empty = true;
              for (let j = i + 1; j < tops.length; j++) {
                const next = tops[j].node;
                // A heading of the same or higher level ends this section.
                if (
                  next.type.name === "heading" &&
                  (next.attrs.level as number) <= level
                ) {
                  break;
                }
                if (next.textContent.trim().length > 0) {
                  empty = false;
                  break;
                }
              }

              if (empty) {
                decos.push(
                  Decoration.node(offset, offset + node.nodeSize, {
                    class: "dictation-empty-section",
                  }),
                );
              }
            }
            return DecorationSet.create(doc, decos);
          },
        },
      }),
    ];
  },
});
