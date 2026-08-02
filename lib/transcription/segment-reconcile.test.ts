import { describe, expect, it } from "vitest";
import { maxSequence, selectFreshSegments } from "./segment-reconcile";

// These guard the bug where a dropped socket produced a garbled note: the
// editor sliced the server's segment array at a count derived from its own
// live array. A retried append had duplicated rows server-side, so the arrays
// no longer lined up and the slice dumped already-inserted text into the note.

const seg = (sequence: number, text = `s${sequence}`) => ({ sequence, text });

describe("selectFreshSegments", () => {
  it("takes only what is past the processed high-water mark", () => {
    const all = [seg(0), seg(1), seg(2), seg(3)];
    expect(selectFreshSegments(all, 1).map((s) => s.text)).toEqual([
      "s2",
      "s3",
    ]);
  });

  it("takes everything when nothing has been processed", () => {
    expect(selectFreshSegments([seg(0), seg(1)], -1)).toHaveLength(2);
  });

  it("takes nothing when all sequences are already processed", () => {
    expect(selectFreshSegments([seg(0), seg(1)], 1)).toEqual([]);
  });

  it("orders by sequence regardless of the order it was given", () => {
    // The server's collection order is its own business; the note is rebuilt by
    // walking this list, so it has to come out in transcript order.
    const shuffled = [seg(2), seg(0), seg(3), seg(1)];
    expect(selectFreshSegments(shuffled, -1).map((s) => s.text)).toEqual([
      "s0",
      "s1",
      "s2",
      "s3",
    ]);
  });

  it("collapses a repeated sequence to its first occurrence", () => {
    // What a retried append used to leave behind. Inserting both copies is
    // exactly the duplicated text that showed up in the note.
    const withDupes = [
      seg(0, "the patient reports"),
      seg(1, "chest pain"),
      seg(0, "the patient reports"),
      seg(1, "chest pain"),
    ];
    expect(selectFreshSegments(withDupes, -1).map((s) => s.text)).toEqual([
      "the patient reports",
      "chest pain",
    ]);
  });

  it("does not mutate the input", () => {
    const all = [seg(2), seg(0), seg(1)];
    const before = all.map((s) => s.sequence);
    selectFreshSegments(all, -1);
    expect(all.map((s) => s.sequence)).toEqual(before);
  });

  it("survives a server array that is shorter than what was processed", () => {
    // Defensive: a count-based slice would go out of bounds or re-insert here.
    expect(selectFreshSegments([seg(0)], 5)).toEqual([]);
  });
});

describe("maxSequence", () => {
  it("returns the highest sequence present", () => {
    expect(maxSequence([seg(0), seg(7), seg(3)])).toBe(7);
  });

  it("falls back for an empty list", () => {
    expect(maxSequence([])).toBe(-1);
    expect(maxSequence([], 4)).toBe(4);
  });

  it("never regresses below the fallback", () => {
    // Seeded resumes pass the current mark as the fallback; a stale batch of
    // lower sequences must not drag it backwards.
    expect(maxSequence([seg(1), seg(2)], 9)).toBe(9);
  });
});
