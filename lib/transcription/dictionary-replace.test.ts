import { describe, expect, it } from "vitest";
import {
  applyDictionary,
  compileDictionary,
  type DictionaryReplacement,
} from "./dictionary-replace";

const DICT: DictionaryReplacement[] = [
  { spokenForm: "BP", writtenForm: "blood pressure" },
  { spokenForm: "ECG", writtenForm: "electrocardiogram" },
  { spokenForm: "blood", writtenForm: "BLOOD" },
  // Recognition-only — no written form, must never rewrite.
  { spokenForm: "ibuprofen", writtenForm: null },
  { spokenForm: "shortness of breath", writtenForm: "SOB" },
];

describe("applyDictionary — replacement", () => {
  it("rewrites a spoken form to its written form", () => {
    expect(applyDictionary("BP is elevated", DICT)).toBe(
      "blood pressure is elevated",
    );
  });

  it("is case-insensitive when matching", () => {
    expect(applyDictionary("the ecg looks normal", DICT)).toBe(
      "the electrocardiogram looks normal",
    );
  });

  it("inserts the written form verbatim, regardless of the matched casing", () => {
    expect(applyDictionary("BP was high. ecg done.", DICT)).toBe(
      "blood pressure was high. electrocardiogram done.",
    );
  });

  it("collapses a multi-word spoken form", () => {
    expect(applyDictionary("patient reports shortness of breath", DICT)).toBe(
      "patient reports SOB",
    );
  });
});

describe("applyDictionary — boundaries & safety", () => {
  it("does not match inside a larger word", () => {
    // "BP" must not fire inside "BPM"; "blood" must not fire inside "bloodhound".
    expect(applyDictionary("120 BPM and a bloodhound", DICT)).toBe(
      "120 BPM and a bloodhound",
    );
  });

  it("leaves recognition-only entries untouched", () => {
    expect(applyDictionary("gave ibuprofen 400mg", DICT)).toBe(
      "gave ibuprofen 400mg",
    );
  });

  it("is a no-op for an empty dictionary or empty text", () => {
    expect(applyDictionary("BP is elevated", [])).toBe("BP is elevated");
    expect(applyDictionary("", DICT)).toBe("");
  });

  it("prefers the longer spoken form when terms overlap", () => {
    const dict: DictionaryReplacement[] = [
      { spokenForm: "heart", writtenForm: "HEART" },
      { spokenForm: "heart attack", writtenForm: "myocardial infarction" },
    ];
    expect(applyDictionary("a heart attack", dict)).toBe(
      "a myocardial infarction",
    );
  });
});

describe("compileDictionary", () => {
  it("drops entries with no written form", () => {
    expect(compileDictionary(DICT)).toHaveLength(4);
  });
});
