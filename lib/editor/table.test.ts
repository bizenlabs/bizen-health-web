import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { Markdown, MarkdownManager } from "@tiptap/markdown";
import { TableExtensions } from "./table";

describe("table schema roles", () => {
  // prosemirror-tables drives every editing command (add/delete row+column,
  // Tab navigation, cell selection) off `spec.tableRole`. extendNodeSchema is a
  // GLOBAL hook, so a naive per-node constant tags all four nodes the same and
  // silently breaks editing while leaving rendering/markdown intact — this
  // guards that regression.
  const schema = getSchema([StarterKit, ...TableExtensions]);
  it.each([
    ["table", "table"],
    ["tableRow", "row"],
    ["tableHeader", "header_cell"],
    ["tableCell", "cell"],
  ])("%s has tableRole %s", (node, expectedRole) => {
    expect(schema.nodes[node].spec.tableRole).toBe(expectedRole);
  });
});

// Exercises the actual table node handlers (not a replica) through the same
// MarkdownManager the editor uses, so the clinical-note save path — seed via
// `setContent(markdown)`, persist via `getMarkdown()` — is proven lossless.
const manager = () =>
  new MarkdownManager({
    extensions: [StarterKit, Markdown, ...TableExtensions],
  });

const TABLE = `| Medication | Frequency | Duration | Remarks |
| --- | --- | --- | --- |
| **Amoxicillin 500mg** | 1-0-1 | 5 days | After meals |
| Paracetamol 650mg | 1-1-1 | 3 days | If fever |`;

describe("table markdown round-trip", () => {
  it("parses a GFM table into table/row/header/cell nodes", () => {
    const json = manager().parse(TABLE);
    const table = (json.content ?? []).find((n) => n.type === "table");
    expect(table).toBeTruthy();
    // header row + 2 body rows
    expect(table?.content).toHaveLength(3);
    expect(table?.content?.[0]?.content?.[0]?.type).toBe("tableHeader");
    expect(table?.content?.[1]?.content?.[0]?.type).toBe("tableCell");
  });

  it("serializes table nodes back to the exact pipe table (lossless)", () => {
    const m = manager();
    expect(m.serialize(m.parse(TABLE)).trim()).toBe(TABLE);
  });

  it("preserves bold marks inside cells through the round-trip", () => {
    const m = manager();
    expect(m.serialize(m.parse(TABLE))).toContain("**Amoxicillin 500mg**");
  });

  it("round-trips a table embedded in a larger note", () => {
    const md = `## Rx\n\n${TABLE}`;
    const m = manager();
    expect(m.serialize(m.parse(md)).trim()).toBe(md);
  });
});
