import {
  type JSONContent,
  type MarkdownParseHelpers,
  type MarkdownRendererHelpers,
  type MarkdownToken,
  mergeAttributes,
  Node,
  type NodeConfig,
} from "@tiptap/core";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import {
  addColumnAfter,
  addColumnBefore,
  addRowAfter,
  addRowBefore,
  deleteColumn,
  deleteRow,
  deleteTable,
  goToNextCell,
  tableEditing,
} from "@tiptap/pm/tables";

// GFM tables for the dictation editor, built on prosemirror-tables (shipped in
// @tiptap/pm — no extra dependency). The official @tiptap/extension-table is
// not installable in this environment, so the four node types are declared
// here directly. The defining piece beyond a stock table extension is the
// Markdown round-trip: the editor seeds from and saves to Markdown (see
// dictation-editor.tsx `setContent(..., contentType:"markdown")` /
// `getMarkdown()`), and neither @tiptap/markdown nor prosemirror-tables knows
// how to (de)serialise a pipe table — so the `table` node carries explicit
// `parseMarkdown` / `renderMarkdown` handlers that @tiptap/markdown discovers.

// prosemirror-tables reads `tableRole` off each node's schema spec. Tiptap's
// `extendNodeSchema` is a GLOBAL hook — it runs once per node in the schema and
// merges its return into that node's spec — so a single handler keyed on the
// node name sets the right role on each of the four table nodes (and nothing on
// the rest). Defining it per-node with a constant would not work: every node's
// extendNodeSchema runs against every node, so the last one would win and tag
// all of them identically. Cast isolates the custom `tableRole` spec field,
// which Tiptap's types (Partial<NodeConfig>) don't know about.
type TableRole = "table" | "row" | "cell" | "header_cell";
const TABLE_ROLES: Record<string, TableRole> = {
  table: "table",
  tableRow: "row",
  tableHeader: "header_cell",
  tableCell: "cell",
};
const tableRoleSchema = ((extension: { name: string }) => {
  const tableRole = TABLE_ROLES[extension.name];
  return tableRole ? { tableRole } : {};
}) as unknown as NodeConfig["extendNodeSchema"];

// A bare ProseMirror command — prosemirror-tables' column/row ops have this
// shape. `dispatch` is omitted when Tiptap probes via `editor.can()`.
type PMCommand = (
  state: EditorState,
  dispatch?: (tr: Transaction) => void,
) => boolean;

// Shared attributes for both cell node types.
const cellAttributes = {
  colspan: { default: 1 },
  rowspan: { default: 1 },
  // Ghost-hint text for a cell whose template body was purely a [placeholder].
  // Set on seeding (see applyTableCellPlaceholders); surfaced as placeholder
  // text by the dictation editor and never written to HTML or Markdown, so it
  // can't end up in a saved note.
  placeholder: { default: null, rendered: false },
  colwidth: {
    default: null,
    parseHTML: (el: HTMLElement) => {
      const w = el.getAttribute("data-colwidth");
      const parsed = w ? w.split(",").map((s) => Number.parseInt(s, 10)) : null;
      return parsed && parsed.every((n) => Number.isFinite(n)) ? parsed : null;
    },
    renderHTML: (attrs: { colwidth?: number[] | null }) =>
      attrs.colwidth ? { "data-colwidth": attrs.colwidth.join(",") } : {},
  },
};

// Render one table cell's block content to a single line of Markdown: collapse
// internal newlines to spaces and escape pipes so the row stays well-formed.
function cellMarkdown(
  cell: JSONContent,
  helpers: MarkdownRendererHelpers,
): string {
  const raw = helpers.renderChildren(cell.content ?? []);
  return raw
    .replace(/\r?\n+/g, " ")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim();
}

export const TableRow = Node.create({
  name: "tableRow",
  content: "(tableCell | tableHeader)*",
  parseHTML: () => [{ tag: "tr" }],
  renderHTML: ({ HTMLAttributes }) => [
    "tr",
    mergeAttributes(HTMLAttributes),
    0,
  ],
});

export const TableHeader = Node.create({
  name: "tableHeader",
  content: "block+",
  isolating: true,
  addAttributes: () => cellAttributes,
  parseHTML: () => [{ tag: "th" }],
  renderHTML: ({ HTMLAttributes }) => [
    "th",
    mergeAttributes(HTMLAttributes),
    0,
  ],
});

export const TableCell = Node.create({
  name: "tableCell",
  content: "block+",
  isolating: true,
  addAttributes: () => cellAttributes,
  parseHTML: () => [{ tag: "td" }],
  renderHTML: ({ HTMLAttributes }) => [
    "td",
    mergeAttributes(HTMLAttributes),
    0,
  ],
});

export const Table = Node.create({
  name: "table",
  content: "tableRow+",
  isolating: true,
  group: "block",
  extendNodeSchema: tableRoleSchema,
  parseHTML: () => [{ tag: "table" }],
  renderHTML: ({ HTMLAttributes }) => [
    "table",
    mergeAttributes(HTMLAttributes),
    ["tbody", 0],
  ],

  addProseMirrorPlugins() {
    return [tableEditing({ allowTableNodeSelection: true })];
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => goToNextCell(1)(this.editor.state, this.editor.view.dispatch),
      "Shift-Tab": () =>
        goToNextCell(-1)(this.editor.state, this.editor.view.dispatch),
    };
  },

  // prosemirror-tables ships the column/row ops but no "insert table"; build
  // the node from JSON and let Tiptap insert it. The remaining ops are thin
  // wrappers so the toolbar can drive them through the editor command API.
  addCommands() {
    const wrap =
      (cmd: PMCommand) =>
      () =>
      ({
        state,
        dispatch,
      }: {
        state: EditorState;
        dispatch?: (tr: Transaction) => void;
      }) =>
        cmd(state, dispatch);
    return {
      insertTable:
        ({ rows = 3, cols = 3, withHeaderRow = true } = {}) =>
        ({ commands }) => {
          const emptyCell = (header: boolean): JSONContent => ({
            type: header ? "tableHeader" : "tableCell",
            content: [{ type: "paragraph" }],
          });
          const makeRow = (header: boolean): JSONContent => ({
            type: "tableRow",
            content: Array.from({ length: cols }, () => emptyCell(header)),
          });
          const body = Array.from(
            { length: withHeaderRow ? rows - 1 : rows },
            () => makeRow(false),
          );
          const content = withHeaderRow ? [makeRow(true), ...body] : body;
          return commands.insertContent({ type: "table", content });
        },
      addColumnBefore: wrap(addColumnBefore),
      addColumnAfter: wrap(addColumnAfter),
      deleteColumn: wrap(deleteColumn),
      addRowBefore: wrap(addRowBefore),
      addRowAfter: wrap(addRowAfter),
      deleteRow: wrap(deleteRow),
      deleteTable: wrap(deleteTable),
    };
  },

  // --- Markdown round-trip (discovered by @tiptap/markdown) ----------------
  markdownTokenName: "table",

  parseMarkdown(token: MarkdownToken, helpers: MarkdownParseHelpers) {
    // marked's GFM `table` token: { header: Cell[], rows: Cell[][] },
    // Cell = { text, tokens }.
    const t = token as {
      header?: { tokens?: MarkdownToken[] }[];
      rows?: { tokens?: MarkdownToken[] }[][];
    };
    const cell = (
      c: { tokens?: MarkdownToken[] },
      header: boolean,
    ): JSONContent => ({
      type: header ? "tableHeader" : "tableCell",
      content: [
        { type: "paragraph", content: helpers.parseInline(c.tokens ?? []) },
      ],
    });
    const headerRow: JSONContent = {
      type: "tableRow",
      content: (t.header ?? []).map((c) => cell(c, true)),
    };
    const bodyRows: JSONContent[] = (t.rows ?? []).map((row) => ({
      type: "tableRow",
      content: row.map((c) => cell(c, false)),
    }));
    return { type: "table", content: [headerRow, ...bodyRows] };
  },

  renderMarkdown(node: JSONContent, helpers: MarkdownRendererHelpers) {
    const rows = (node.content ?? []) as JSONContent[];
    if (!rows.length) return "";
    const cellsOf = (row: JSONContent) => (row.content ?? []) as JSONContent[];

    const headerCells = cellsOf(rows[0]);
    const colCount = headerCells.length || 1;
    const line = (cells: JSONContent[]) => {
      const out = Array.from(
        { length: colCount },
        (_, i) => (cells[i] ? cellMarkdown(cells[i], helpers) : "") || " ",
      );
      return `| ${out.join(" | ")} |`;
    };

    return [
      line(headerCells),
      `| ${Array.from({ length: colCount }, () => "---").join(" | ")} |`,
      ...rows.slice(1).map((r) => line(cellsOf(r))),
    ].join("\n");
  },
});

/** The four table node extensions, ready to spread into `useEditor`. */
export const TableExtensions = [Table, TableRow, TableHeader, TableCell];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    table: {
      insertTable: (options?: {
        rows?: number;
        cols?: number;
        withHeaderRow?: boolean;
      }) => ReturnType;
      addColumnBefore: () => ReturnType;
      addColumnAfter: () => ReturnType;
      deleteColumn: () => ReturnType;
      addRowBefore: () => ReturnType;
      addRowAfter: () => ReturnType;
      deleteRow: () => ReturnType;
      deleteTable: () => ReturnType;
    };
  }
}
