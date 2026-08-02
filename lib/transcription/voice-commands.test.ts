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

  it("does not fire 'next line' inside clinical prose", () => {
    const ops = parseUtterance("the next line of treatment is chemotherapy");
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

  it("fires nextLine on its variants", () => {
    expect(cmds(parseUtterance("next line"))).toEqual(["nextLine"]);
    expect(cmds(parseUtterance("go to next line"))).toEqual(["nextLine"]);
    expect(cmds(parseUtterance("go to the next line"))).toEqual(["nextLine"]);
    expect(cmds(parseUtterance("down a line"))).toEqual(["nextLine"]);
  });

  it("fires prevLine on its variants", () => {
    expect(cmds(parseUtterance("previous line"))).toEqual(["prevLine"]);
    expect(cmds(parseUtterance("prior line"))).toEqual(["prevLine"]);
    expect(cmds(parseUtterance("go to previous line"))).toEqual(["prevLine"]);
    expect(cmds(parseUtterance("up a line"))).toEqual(["prevLine"]);
    expect(cmds(parseUtterance("back a line"))).toEqual(["prevLine"]);
  });

  it("keeps 'next line' (move) distinct from 'new line' (insert)", () => {
    expect(cmds(parseUtterance("next line"))).toEqual(["nextLine"]);
    expect(cmds(parseUtterance("new line"))).toEqual(["newline"]);
  });

  it("fires undo", () => {
    expect(cmds(parseUtterance("undo"))).toEqual(["undo"]);
    expect(cmds(parseUtterance("undo that"))).toEqual(["undo"]);
  });
});

describe("parseUtterance — go to line N", () => {
  const line = (ops: VoiceOp[]) =>
    ops.find((o) => o.type === "command" && o.command.kind === "gotoLine");

  it("fires on the navigation-verb variants", () => {
    for (const phrase of [
      "go to line 12",
      "jump to line 12",
      "navigate to line 12",
      "skip to line 12",
      "move to line 12",
      "go to the line 12",
      "line number 12",
    ]) {
      expect(cmds(parseUtterance(phrase))).toEqual(["gotoLine"]);
    }
  });

  it("carries the parsed 1-based line number", () => {
    const ops = parseUtterance("go to line 12");
    expect(ops).toHaveLength(1);
    expect(ops[0].type === "command" && ops[0].command).toEqual({
      kind: "gotoLine",
      line: 12,
    });
  });

  it("accepts spoken number words", () => {
    expect(line(parseUtterance("go to line twelve"))).toBeDefined();
    expect(
      parseUtterance("go to line twenty three").flatMap((o) =>
        o.type === "command" && o.command.kind === "gotoLine"
          ? [o.command.line]
          : [],
      ),
    ).toEqual([23]);
  });

  it("tolerates filler and smart_format punctuation", () => {
    expect(cmds(parseUtterance("okay, go to line 4 please"))).toEqual([
      "gotoLine",
    ]);
    expect(cmds(parseUtterance("Go to line 4."))).toEqual(["gotoLine"]);
  });

  it("wins over the section lookup, which would swallow the number", () => {
    // Without the earlier gotoLine pattern this would be gotoSection "line 12"
    // and fall back to literal text.
    expect(cmds(parseUtterance("go to line 12"))).toEqual(["gotoLine"]);
    expect(cmds(parseUtterance("go to assessment"))).toEqual(["gotoSection"]);
  });

  it("stays distinct from the relative line commands", () => {
    expect(cmds(parseUtterance("go to the next line"))).toEqual(["nextLine"]);
    expect(cmds(parseUtterance("go to previous line"))).toEqual(["prevLine"]);
  });

  it("does not fire on prose that merely mentions a line number", () => {
    expect(cmds(parseUtterance("move to line two of the protocol"))).toEqual(
      [],
    );
    expect(cmds(parseUtterance("we will go to line 3 of the ward"))).toEqual(
      [],
    );
    expect(cmds(parseUtterance("second line therapy was started"))).toEqual([]);
  });

  it("falls through to text when no number follows", () => {
    const ops = parseUtterance("go to line");
    expect(cmds(ops)).toEqual(["gotoSection"]);
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

describe("parseUtterance — table navigation", () => {
  it("fires gotoTable on its variants", () => {
    expect(cmds(parseUtterance("go to table"))).toEqual(["gotoTable"]);
    expect(cmds(parseUtterance("go to the table"))).toEqual(["gotoTable"]);
    expect(cmds(parseUtterance("jump to table"))).toEqual(["gotoTable"]);
    expect(cmds(parseUtterance("enter the table"))).toEqual(["gotoTable"]);
    expect(cmds(parseUtterance("next table"))).toEqual(["gotoTable"]);
    expect(cmds(parseUtterance("go to next table"))).toEqual(["gotoTable"]);
  });

  it("does not fire gotoTable inside prose", () => {
    expect(
      cmds(parseUtterance("the next table shows the dosing schedule")),
    ).toEqual([]);
  });

  it("fires nextCell on its phrases", () => {
    expect(cmds(parseUtterance("next cell"))).toEqual(["nextCell"]);
    expect(cmds(parseUtterance("next column"))).toEqual(["nextCell"]);
  });

  it("fires prevCell on its variants", () => {
    expect(cmds(parseUtterance("previous cell"))).toEqual(["prevCell"]);
    expect(cmds(parseUtterance("prior cell"))).toEqual(["prevCell"]);
    expect(cmds(parseUtterance("back a cell"))).toEqual(["prevCell"]);
  });

  it("fires cellUp / cellDown", () => {
    expect(cmds(parseUtterance("cell up"))).toEqual(["cellUp"]);
    expect(cmds(parseUtterance("up a cell"))).toEqual(["cellUp"]);
    expect(cmds(parseUtterance("cell down"))).toEqual(["cellDown"]);
    expect(cmds(parseUtterance("cell below"))).toEqual(["cellDown"]);
  });

  it("fires nextRow on its phrases", () => {
    expect(cmds(parseUtterance("next row"))).toEqual(["nextRow"]);
    expect(cmds(parseUtterance("new row"))).toEqual(["nextRow"]);
    expect(cmds(parseUtterance("down a row"))).toEqual(["nextRow"]);
  });

  it("fires structural add/delete commands", () => {
    expect(cmds(parseUtterance("add a row"))).toEqual(["addRow"]);
    expect(cmds(parseUtterance("insert row"))).toEqual(["addRow"]);
    expect(cmds(parseUtterance("add a column"))).toEqual(["addColumn"]);
    expect(cmds(parseUtterance("delete row"))).toEqual(["deleteRow"]);
    expect(cmds(parseUtterance("remove this row"))).toEqual(["deleteRow"]);
    expect(cmds(parseUtterance("delete column"))).toEqual(["deleteColumn"]);
  });

  it("tolerates filler and trailing punctuation", () => {
    expect(cmds(parseUtterance("okay, next cell please"))).toEqual([
      "nextCell",
    ]);
    expect(cmds(parseUtterance("Next cell."))).toEqual(["nextCell"]);
  });

  it("still returns the command intact in punctuation mode", () => {
    expect(cmds(parseUtterance("next cell", { punctuation: true }))).toEqual([
      "nextCell",
    ]);
  });

  it("does not fire on prose containing the phrases", () => {
    expect(
      cmds(parseUtterance("the next cell of the colony was examined")),
    ).toEqual([]);
    expect(cmds(parseUtterance("we will add a row of sutures"))).toEqual([]);
  });

  it("keeps section and structure commands distinct from table ones", () => {
    // Regression guards: similar-sounding commands resolve to their own kind.
    expect(cmds(parseUtterance("next section"))).toEqual(["nextSection"]);
    expect(cmds(parseUtterance("new paragraph"))).toEqual(["paragraph"]);
  });
});

describe("parseUtterance — command merged into a dictated final", () => {
  it("peels a trailing command off dictated text", () => {
    const ops = parseUtterance("75 milligrams. Next cell.");
    expect(texts(ops)).toEqual(["75 milligrams."]);
    expect(cmds(ops)).toEqual(["nextCell"]);
  });

  it("fires nextRow when merged after a value", () => {
    expect(cmds(parseUtterance("aspirin given. Next row."))).toEqual([
      "nextRow",
    ]);
  });

  it("handles a command between two dictated sentences", () => {
    const ops = parseUtterance("patient stable. Next cell. Aspirin given.");
    expect(texts(ops)).toEqual(["patient stable.", "Aspirin given."]);
    expect(cmds(ops)).toEqual(["nextCell"]);
  });

  it("does not fire when a command phrase is only part of a sentence", () => {
    const ops = parseUtterance("we examined the next cell. it was empty.");
    expect(cmds(ops)).toEqual([]);
  });

  it("does not split a decimal value mid-number", () => {
    const ops = parseUtterance("dose is 0.5 mg. Next cell.");
    expect(texts(ops)).toEqual(["dose is 0.5 mg."]);
    expect(cmds(ops)).toEqual(["nextCell"]);
  });
});

describe("parseUtterance — every command survives a trailing period / merge", () => {
  // One representative phrase per command kind. Each must (a) fire on its own
  // when smart_format appends a period, and (b) fire when Deepgram merges it
  // into the same final as preceding dictated text.
  const cases: { phrase: string; kind: string }[] = [
    { phrase: "new line", kind: "newline" },
    { phrase: "new paragraph", kind: "paragraph" },
    { phrase: "next section", kind: "nextSection" },
    { phrase: "previous section", kind: "prevSection" },
    { phrase: "next line", kind: "nextLine" },
    { phrase: "previous line", kind: "prevLine" },
    { phrase: "go to assessment", kind: "gotoSection" },
    { phrase: "go to line 12", kind: "gotoLine" },
    { phrase: "scratch that", kind: "scratchThat" },
    { phrase: "undo", kind: "undo" },
    { phrase: "go to table", kind: "gotoTable" },
    { phrase: "next cell", kind: "nextCell" },
    { phrase: "previous cell", kind: "prevCell" },
    { phrase: "cell up", kind: "cellUp" },
    { phrase: "cell down", kind: "cellDown" },
    { phrase: "next row", kind: "nextRow" },
    { phrase: "add a row", kind: "addRow" },
    { phrase: "add a column", kind: "addColumn" },
    { phrase: "delete row", kind: "deleteRow" },
    { phrase: "delete column", kind: "deleteColumn" },
  ];

  for (const { phrase, kind } of cases) {
    it(`'${phrase}' fires standalone with a trailing period`, () => {
      expect(cmds(parseUtterance(`${phrase}.`))).toEqual([kind]);
    });

    it(`'${phrase}' fires when merged after dictated text`, () => {
      const ops = parseUtterance(`noted. ${phrase}.`);
      expect(cmds(ops)).toEqual([kind]);
      expect(texts(ops)).toEqual(["noted."]);
    });
  }
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
