import { describe, expect, it } from "vitest";
import { documentToBlocks, isEmptyDocument } from "./blocks";

// A ProseMirror table doc as the editor's getJSON() would produce it.
const tableDoc = {
  type: "doc",
  content: [
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableHeader",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Medication" }],
                },
              ],
            },
            {
              type: "tableHeader",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Frequency" }],
                },
              ],
            },
          ],
        },
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [
                    {
                      type: "text",
                      text: "Amoxicillin",
                      marks: [{ type: "bold" }],
                    },
                  ],
                },
              ],
            },
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "1-0-1" }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("documentToBlocks — tables", () => {
  it("walks a table into a table block with header flags and styled runs", () => {
    const blocks = documentToBlocks(tableDoc);
    expect(blocks).toHaveLength(1);
    const block = blocks[0];
    expect(block.kind).toBe("table");
    if (block.kind !== "table") return;
    expect(block.rows).toHaveLength(2);
    expect(block.rows[0][0].header).toBe(true);
    expect(block.rows[0][0].runs[0].text).toBe("Medication");
    expect(block.rows[1][0].header).toBe(false);
    expect(block.rows[1][0].runs[0].bold).toBe(true);
  });

  it("treats a table with text as a non-empty document", () => {
    expect(isEmptyDocument(documentToBlocks(tableDoc))).toBe(false);
  });

  it("treats an all-empty table as an empty document", () => {
    const empty = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableCell", content: [{ type: "paragraph" }] },
              ],
            },
          ],
        },
      ],
    };
    expect(isEmptyDocument(documentToBlocks(empty))).toBe(true);
  });
});
