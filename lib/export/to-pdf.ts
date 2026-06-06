import type { Content, Decoration } from "pdfmake/interfaces";
import type { Block, InlineRun, ListItem } from "./blocks";
import type { DocMeta } from "./to-docx";

// Renders the format-agnostic block model (see `blocks.ts`) to a PDF Blob
// using pdfmake. Both pdfmake and its bundled font VFS are imported
// dynamically so the (large) PDF engine stays out of the main client bundle.
//
// pdfmake ships only the Roboto font family in its default VFS, so inline
// `code` / code blocks are conveyed with a grey background rather than a true
// monospace face — the formatting (headings, bold, italic, underline,
// strikethrough, ordered/bulleted/nested lists, quotes, rules) is preserved.

const HEADING_STYLE = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

function inline(run: InlineRun): Content {
  const decoration: Decoration[] = [];
  if (run.underline) decoration.push("underline");
  if (run.strike) decoration.push("lineThrough");
  return {
    text: run.text,
    bold: run.bold,
    italics: run.italic,
    ...(decoration.length ? { decoration } : {}),
    ...(run.code ? { background: "#f4f4f5" } : {}),
  };
}

// Render a list item (a sequence of blocks) into a single pdfmake list entry.
// A lone paragraph becomes its inline content; a paragraph plus a nested list
// (or other extra blocks) is wrapped in a `stack` so one marker covers it.
function listEntry(item: ListItem): Content {
  const parts = item.flatMap(renderBlock);
  if (parts.length === 1) return parts[0];
  return { stack: parts };
}

function renderBlock(block: Block): Content[] {
  switch (block.kind) {
    case "heading":
      return [
        { text: block.runs.map(inline), style: HEADING_STYLE[block.level - 1] },
      ];

    case "paragraph":
      return [{ text: block.runs.map(inline), style: "paragraph" }];

    case "list":
      return [
        block.ordered
          ? {
              ol: block.items.map(listEntry),
              start: block.start,
              style: "list",
            }
          : { ul: block.items.map(listEntry), style: "list" },
      ];

    case "blockquote":
      return [
        {
          stack: block.children.flatMap(renderBlock),
          margin: [12, 2, 0, 6],
          color: "#52525b",
          italics: true,
        },
      ];

    case "codeBlock":
      return [
        {
          text: block.text || " ",
          preserveLeadingSpaces: true,
          background: "#f4f4f5",
          color: "#27272a",
          margin: [0, 2, 0, 8],
        },
      ];

    case "rule":
      return [
        {
          canvas: [
            {
              type: "line",
              x1: 0,
              y1: 0,
              x2: 515,
              y2: 0,
              lineWidth: 1,
              lineColor: "#a1a1aa",
            },
          ],
          margin: [0, 6, 0, 10],
        },
      ];
  }
}

export async function blocksToPdfBlob(
  blocks: Block[],
  meta: DocMeta,
): Promise<Blob> {
  const [pdfMakeMod, vfsMod] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfMake =
    (pdfMakeMod as { default?: PdfMake } & PdfMake).default ??
    (pdfMakeMod as unknown as PdfMake);
  const vfs =
    (vfsMod as { default?: Record<string, string> }).default ??
    (vfsMod as unknown as Record<string, string>);
  // pdfmake 0.3.x registers fonts into its virtual filesystem via this method
  // (the default Roboto font family is already configured on the instance).
  pdfMake.addVirtualFileSystem(vfs);

  const content: Content[] = [
    { text: meta.title, style: "title" },
    ...(meta.subtitle
      ? [{ text: meta.subtitle, style: "subtitle" } as Content]
      : []),
    ...blocks.flatMap(renderBlock),
  ];

  const docDefinition = {
    info: { title: meta.title },
    content,
    defaultStyle: { fontSize: 11, lineHeight: 1.3 },
    styles: {
      title: { fontSize: 22, bold: true, margin: [0, 0, 0, 2] },
      subtitle: { fontSize: 10, color: "#71717a", margin: [0, 0, 0, 14] },
      h1: { fontSize: 18, bold: true, margin: [0, 10, 0, 4] },
      h2: { fontSize: 15, bold: true, margin: [0, 8, 0, 4] },
      h3: { fontSize: 13, bold: true, margin: [0, 6, 0, 3] },
      h4: { fontSize: 12, bold: true, margin: [0, 6, 0, 3] },
      h5: { fontSize: 11, bold: true, margin: [0, 4, 0, 2] },
      h6: { fontSize: 11, bold: true, italics: true, margin: [0, 4, 0, 2] },
      paragraph: { margin: [0, 0, 0, 6] },
      list: { margin: [0, 0, 0, 6] },
    },
    pageMargins: [56, 56, 56, 56] as [number, number, number, number],
  };

  // getBlob() is promise-based in pdfmake 0.3.x.
  return pdfMake.createPdf(docDefinition).getBlob();
}

// The slice of the pdfmake instance API this module uses. pdfmake ships no
// types for its build entry, so we declare just what we touch.
type PdfMake = {
  addVirtualFileSystem: (vfs: Record<string, string>) => void;
  createPdf: (docDefinition: unknown) => { getBlob: () => Promise<Blob> };
};
