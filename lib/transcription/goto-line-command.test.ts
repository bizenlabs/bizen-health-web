import { describe, expect, it } from "vitest";
import { parseGotoLine } from "./goto-line-command";

describe("parseGotoLine — matches", () => {
  it("parses numerals with a full command phrase", () => {
    expect(parseGotoLine("go to line 12")).toBe(12);
    expect(parseGotoLine("goto line 3")).toBe(3);
    expect(parseGotoLine("jump to line 250")).toBe(250);
  });

  it("parses a bare 'line N'", () => {
    expect(parseGotoLine("line 7")).toBe(7);
  });

  it("tolerates trailing punctuation and filler smart_format adds", () => {
    expect(parseGotoLine("Go to line 12.")).toBe(12);
    expect(parseGotoLine("line number 5")).toBe(5);
    expect(parseGotoLine("line #9")).toBe(9);
  });

  it("parses spoken number words", () => {
    expect(parseGotoLine("go to line twelve")).toBe(12);
    expect(parseGotoLine("line twenty three")).toBe(23);
    expect(parseGotoLine("line forty-five")).toBe(45);
    expect(parseGotoLine("jump to line one hundred")).toBe(100);
    expect(parseGotoLine("line one hundred and two")).toBe(102);
  });

  it("is case-insensitive", () => {
    expect(parseGotoLine("GO TO LINE 4")).toBe(4);
  });
});

describe("parseGotoLine — non-matches (must return null)", () => {
  it("ignores prose that merely contains a number", () => {
    expect(parseGotoLine("the patient is 42 years old")).toBeNull();
    expect(parseGotoLine("go to the assessment section")).toBeNull();
  });

  it("does not match 'line' embedded in another word", () => {
    expect(parseGotoLine("underline the heading 3")).toBeNull();
    expect(parseGotoLine("deadline is 5 days")).toBeNull();
  });

  it("returns null when there is no number after 'line'", () => {
    expect(parseGotoLine("line")).toBeNull();
    expect(parseGotoLine("go to line please")).toBeNull();
  });

  it("rejects line zero and empty input", () => {
    expect(parseGotoLine("go to line 0")).toBeNull();
    expect(parseGotoLine("")).toBeNull();
  });
});
