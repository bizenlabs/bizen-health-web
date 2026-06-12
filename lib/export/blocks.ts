// A small, format-agnostic document model that sits between the Tiptap
// (ProseMirror) editor and the concrete exporters (DOCX, PDF). Walking the
// editor's structured JSON — rather than its Markdown or rasterised HTML —
// is what lets both exporters preserve the note's formatting: headings,
// bold/italic/underline/strike, inline code, ordered/bulleted lists
// (including nesting), block quotes, code blocks and rules.
//
// The two renderers (`to-docx.ts`, `to-pdf.ts`) consume this model so the
// node-walking logic lives in exactly one place.

export type InlineRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
};

export type ListItem = Block[];

export type TableCellModel = { header: boolean; runs: InlineRun[] };
export type TableRowModel = TableCellModel[];

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; runs: InlineRun[] }
  | { kind: "paragraph"; runs: InlineRun[] }
  | { kind: "blockquote"; children: Block[] }
  | { kind: "list"; ordered: boolean; start: number; items: ListItem[] }
  | { kind: "table"; rows: TableRowModel[] }
  | { kind: "codeBlock"; text: string }
  | { kind: "rule" };

// Minimal shape of the ProseMirror JSON we read. Kept loose on purpose — the
// walker tolerates unknown node and mark types by recursing/ignoring rather
// than throwing, so a future editor extension can't break export.
type PMMark = { type: string };
type PMNode = {
  type: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: PMMark[];
  content?: PMNode[];
};

function clampLevel(level: unknown): 1 | 2 | 3 | 4 | 5 | 6 {
  const n = typeof level === "number" ? level : 1;
  return (Math.min(6, Math.max(1, Math.round(n))) || 1) as
    | 1
    | 2
    | 3
    | 4
    | 5
    | 6;
}

// Flatten a node's inline content into styled runs. `hardBreak` becomes a
// newline within a run so paragraphs keep their internal line breaks.
function inlineRuns(content: PMNode[] | undefined): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const node of content ?? []) {
    if (node.type === "hardBreak") {
      runs.push({ text: "\n" });
      continue;
    }
    if (node.type === "text" && node.text) {
      const marks = new Set((node.marks ?? []).map((m) => m.type));
      runs.push({
        text: node.text,
        bold: marks.has("bold") || undefined,
        italic: marks.has("italic") || undefined,
        underline: marks.has("underline") || undefined,
        strike: marks.has("strike") || undefined,
        code: marks.has("code") || undefined,
      });
      continue;
    }
    // Unknown inline node with children (e.g. a link) — recurse so its text
    // survives even if the mark itself is dropped.
    if (node.content) runs.push(...inlineRuns(node.content));
  }
  return runs;
}

// Concatenate the plain text of a code block, preserving its newlines.
function codeText(content: PMNode[] | undefined): string {
  return (content ?? [])
    .map((n) => (n.type === "hardBreak" ? "\n" : (n.text ?? "")))
    .join("");
}

// A list item's content is itself a sequence of blocks (typically one
// paragraph, optionally followed by a nested list).
function listItem(node: PMNode): ListItem {
  return blocksFrom(node.content);
}

// A table cell's content is block-level (usually a single paragraph). Flatten
// it to one run sequence, joining multiple paragraphs with a newline.
function cellRuns(cell: PMNode): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const block of cell.content ?? []) {
    if (runs.length) runs.push({ text: "\n" });
    runs.push(...inlineRuns(block.content));
  }
  return runs;
}

function tableRows(node: PMNode): TableRowModel[] {
  const rows: TableRowModel[] = [];
  for (const row of node.content ?? []) {
    if (row.type !== "tableRow") continue;
    rows.push(
      (row.content ?? []).map((cell) => ({
        header: cell.type === "tableHeader",
        runs: cellRuns(cell),
      })),
    );
  }
  return rows;
}

function blockFrom(node: PMNode): Block | Block[] | null {
  switch (node.type) {
    case "heading":
      return {
        kind: "heading",
        level: clampLevel(node.attrs?.level),
        runs: inlineRuns(node.content),
      };
    case "paragraph":
      return { kind: "paragraph", runs: inlineRuns(node.content) };
    case "blockquote":
      return { kind: "blockquote", children: blocksFrom(node.content) };
    case "bulletList":
      return {
        kind: "list",
        ordered: false,
        start: 1,
        items: (node.content ?? []).map(listItem),
      };
    case "orderedList":
      return {
        kind: "list",
        ordered: true,
        start: typeof node.attrs?.start === "number" ? node.attrs.start : 1,
        items: (node.content ?? []).map(listItem),
      };
    case "table":
      return { kind: "table", rows: tableRows(node) };
    case "codeBlock":
      return { kind: "codeBlock", text: codeText(node.content) };
    case "horizontalRule":
      return { kind: "rule" };
    default:
      // Unknown block: recurse so descendant blocks still export.
      return node.content ? blocksFrom(node.content) : null;
  }
}

function blocksFrom(content: PMNode[] | undefined): Block[] {
  const out: Block[] = [];
  for (const node of content ?? []) {
    const block = blockFrom(node);
    if (Array.isArray(block)) out.push(...block);
    else if (block) out.push(block);
  }
  return out;
}

/** Convert a ProseMirror document (Tiptap `editor.getJSON()`) to the model. */
export function documentToBlocks(doc: unknown): Block[] {
  const root = doc as PMNode | undefined;
  return blocksFrom(root?.content);
}

/** True when the document has no renderable text — used to disable export. */
export function isEmptyDocument(blocks: Block[]): boolean {
  const hasText = (runs: InlineRun[]) => runs.some((r) => r.text.trim());
  const walk = (bs: Block[]): boolean =>
    bs.some((b) => {
      switch (b.kind) {
        case "heading":
        case "paragraph":
          return hasText(b.runs);
        case "blockquote":
          return walk(b.children);
        case "list":
          return b.items.some(walk);
        case "table":
          return b.rows.some((row) => row.some((cell) => hasText(cell.runs)));
        case "codeBlock":
          return b.text.trim().length > 0;
        case "rule":
          return false;
      }
    });
  return !walk(blocks);
}
