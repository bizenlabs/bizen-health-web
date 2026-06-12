import { describe, expect, it } from "vitest";
import {
  findTableBlocks,
  isDelimiterRow,
  splitCells,
  tableLineIndices,
} from "./markdown-table";

describe("splitCells", () => {
  it("splits a fully-piped row, trimming cells", () => {
    expect(splitCells("| a | b | c |")).toEqual(["a", "b", "c"]);
  });
  it("handles rows without outer pipes", () => {
    expect(splitCells("a | b")).toEqual(["a", "b"]);
  });
  it("does not split on escaped pipes, and unescapes them", () => {
    expect(splitCells("| x \\| y | z |")).toEqual(["x | y", "z"]);
  });
});

describe("isDelimiterRow", () => {
  it("recognises plain and aligned delimiters", () => {
    expect(isDelimiterRow("| --- | --- |")).toBe(true);
    expect(isDelimiterRow("| :--- | ---: | :--: |")).toBe(true);
    expect(isDelimiterRow("---|---")).toBe(true);
  });
  it("rejects content rows", () => {
    expect(isDelimiterRow("| a | b |")).toBe(false);
    expect(isDelimiterRow("plain text")).toBe(false);
  });
});

describe("findTableBlocks / tableLineIndices", () => {
  const lines = [
    "## Rx",
    "",
    "| M | F |",
    "| --- | --- |",
    "| Amox | 1-0-1 |",
    "| Para | 1-1-1 |",
    "",
    "done",
  ];

  it("locates a single table with header and rows", () => {
    const blocks = findTableBlocks(lines);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].header).toEqual(["M", "F"]);
    expect(blocks[0].rows).toEqual([
      ["Amox", "1-0-1"],
      ["Para", "1-1-1"],
    ]);
    expect(blocks[0].start).toBe(2);
    expect(blocks[0].end).toBe(5);
  });

  it("marks exactly the table's line span", () => {
    expect([...tableLineIndices(lines)].sort((a, b) => a - b)).toEqual([
      2, 3, 4, 5,
    ]);
  });

  it("returns nothing when there is no delimiter row", () => {
    expect(findTableBlocks(["| a | b |", "| c | d |"])).toEqual([]);
  });
});
