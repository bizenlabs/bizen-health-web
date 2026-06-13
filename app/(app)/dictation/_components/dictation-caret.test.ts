import { describe, expect, it } from "vitest";
import { getSchema } from "@tiptap/core";
import { EditorState } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";
import {
  DictationCaret,
  dictationCaretKey,
  dictationCaretPlugin,
} from "./dictation-caret";

// Drives the plugin's state.apply directly (no DOM): the caret position is set
// via meta, cleared with null, and otherwise mapped through document changes so
// it tracks the insertion point across the stream's edits.
const schema = getSchema([StarterKit, DictationCaret]);

function docState() {
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [schema.text("Hello world")]),
  ]);
  return EditorState.create({ schema, doc, plugins: [dictationCaretPlugin] });
}

describe("dictationCaret plugin", () => {
  it("starts with no caret", () => {
    expect(dictationCaretKey.getState(docState())).toBeNull();
  });

  it("shows the caret at an explicit position", () => {
    const state = docState();
    const next = state.apply(state.tr.setMeta(dictationCaretKey, 6));
    expect(dictationCaretKey.getState(next)).toBe(6);
  });

  it("clears the caret when set to null", () => {
    let state = docState();
    state = state.apply(state.tr.setMeta(dictationCaretKey, 6));
    state = state.apply(state.tr.setMeta(dictationCaretKey, null));
    expect(dictationCaretKey.getState(state)).toBeNull();
  });

  it("maps the caret forward when text is inserted before it", () => {
    let state = docState();
    state = state.apply(state.tr.setMeta(dictationCaretKey, 6)); // after "Hello"
    // Insert 3 chars at the very start of the paragraph (pos 1).
    state = state.apply(state.tr.insertText("Hi ", 1));
    expect(dictationCaretKey.getState(state)).toBe(9);
  });
});
