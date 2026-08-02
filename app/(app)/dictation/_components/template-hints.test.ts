import { describe, expect, it } from "vitest";
import { cellHint } from "./template-hints";

// cellHint decides which table cells seed as ghost placeholders (a hint and no
// meaningful leftover text) vs. stay as literal content (labels, row numbers).
describe("cellHint", () => {
  it("treats a multi-bracket cell as a placeholder, joining the hints", () => {
    expect(cellHint("[Drug name and strength] — [composition]")).toEqual({
      hint: "Drug name and strength — composition",
      meaningful: "",
    });
  });

  it("treats a single-bracket cell as a placeholder", () => {
    expect(cellHint("[1-0-0]")).toEqual({ hint: "1-0-0", meaningful: "" });
  });

  it("keeps a header label as content (no hint)", () => {
    const r = cellHint("Medication (composition)");
    expect(r.hint).toBe("");
    expect(r.meaningful).toBe("Medication");
  });

  it.each(["#", "1", "2"])("keeps the literal %s as content", (text) => {
    const r = cellHint(text);
    expect(r.hint).toBe("");
    expect(r.meaningful).toBe("");
  });
});
