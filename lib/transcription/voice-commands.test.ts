import { describe, expect, it } from "vitest";
import { parseUtterance, type VoiceOp } from "./voice-commands";

// Helpers to assert on the op stream concisely.
const cmds = (ops: VoiceOp[]) =>
  ops.filter((o) => o.type === "command").map((o) => o.command.kind);
const texts = (ops: VoiceOp[]) =>
  ops.filter((o) => o.type === "text").map((o) => o.text);
const isPlainText = (ops: VoiceOp[], expected: string) =>
  ops.length === 1 && ops[0].type === "text" && ops[0].text === expected;

describe("parseUtterance — false positives (must NOT fire)", () => {
  it("does not treat 'period' inside a sentence as a command", () => {
    const ops = parseUtterance("the patient had a quiet period overnight");
    expect(cmds(ops)).toEqual([]);
    expect(isPlainText(ops, "the patient had a quiet period overnight")).toBe(
      true,
    );
  });

  it("does not fire navigation on prose containing 'go back'", () => {
    const ops = parseUtterance("we will go back to work next week");
    expect(cmds(ops)).toEqual([]);
  });

  it("does not fire 'scratch that' embedded in a sentence", () => {
    const ops = parseUtterance("there was a scratch that needed dressing");
    expect(cmds(ops)).toEqual([]);
  });

  it("does not fire 'next section' embedded in a longer sentence", () => {
    const ops = parseUtterance(
      "schedule the next section of the report for tomorrow",
    );
    expect(cmds(ops)).toEqual([]);
  });

  it("does not fire 'new line' when part of a phrase like 'in line'", () => {
    const ops = parseUtterance("there is a new patient in line two");
    expect(cmds(ops)).toEqual([]);
  });
});

describe("parseUtterance — true positives (whole-utterance commands)", () => {
  it("fires nextSection on a standalone utterance", () => {
    expect(cmds(parseUtterance("next section"))).toEqual(["nextSection"]);
  });

  it("tolerates trailing punctuation from smart_format", () => {
    expect(cmds(parseUtterance("Next section."))).toEqual(["nextSection"]);
  });

  it("strips leading filler", () => {
    expect(cmds(parseUtterance("okay, scratch that"))).toEqual(["scratchThat"]);
  });

  it("strips trailing filler", () => {
    expect(cmds(parseUtterance("next section please"))).toEqual([
      "nextSection",
    ]);
  });

  it("fires prevSection on its variants", () => {
    expect(cmds(parseUtterance("previous section"))).toEqual(["prevSection"]);
    expect(cmds(parseUtterance("go back a section"))).toEqual(["prevSection"]);
  });

  it("captures the goto target", () => {
    const ops = parseUtterance("go to assessment");
    expect(ops).toHaveLength(1);
    expect(ops[0].type === "command" && ops[0].command).toEqual({
      kind: "gotoSection",
      target: "assessment",
      raw: "go to assessment",
    });
  });

  it("fires undo", () => {
    expect(cmds(parseUtterance("undo"))).toEqual(["undo"]);
    expect(cmds(parseUtterance("undo that"))).toEqual(["undo"]);
  });
});

describe("parseUtterance — inline whitespace commands", () => {
  it("fires 'new line' as a standalone utterance", () => {
    expect(cmds(parseUtterance("new line"))).toEqual(["newline"]);
  });

  it("does not leave a stray '.' when smart_format punctuates the command", () => {
    const ops = parseUtterance("New line.");
    expect(cmds(ops)).toEqual(["newline"]);
    expect(texts(ops)).toEqual([]);
  });

  it("absorbs punctuation on a mid-sentence break without dropping prose", () => {
    const ops = parseUtterance(
      "vitals are stable. New paragraph. Patient calm",
    );
    expect(cmds(ops)).toEqual(["paragraph"]);
    expect(texts(ops)).toEqual(["vitals are stable.", "Patient calm"]);
  });

  it("splits text around a mid-sentence 'new paragraph'", () => {
    const ops = parseUtterance(
      "vitals are stable new paragraph patient reports",
    );
    expect(texts(ops)).toEqual(["vitals are stable", "patient reports"]);
    expect(cmds(ops)).toEqual(["paragraph"]);
  });

  it("handles multiple inline breaks in order", () => {
    const ops = parseUtterance("one new line two new line three");
    expect(texts(ops)).toEqual(["one", "two", "three"]);
    expect(cmds(ops)).toEqual(["newline", "newline"]);
  });
});

describe("parseUtterance — voice commands disabled / punctuation opt-in", () => {
  it("returns empty ops for blank input", () => {
    expect(parseUtterance("   ")).toEqual([]);
  });

  it("leaves spoken punctuation literal by default", () => {
    const ops = parseUtterance("blood pressure is stable comma rate normal");
    expect(isPlainText(ops, "blood pressure is stable comma rate normal")).toBe(
      true,
    );
  });

  it("applies spoken punctuation when opted in", () => {
    const ops = parseUtterance("rate normal period pressure stable", {
      punctuation: true,
    });
    expect(ops).toHaveLength(1);
    expect(ops[0].type === "text" && ops[0].text).toBe(
      "rate normal. Pressure stable",
    );
  });
});
