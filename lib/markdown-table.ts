// Shared detection/splitting for GFM pipe tables, used by both the template
// preview renderer and the dictation editor's template cleaner. Kept tiny and
// dependency-free — it recognises the same table shape the editor's Markdown
// round-trip (lib/editor/table.ts, via marked) produces, so a table authored in
// a template survives intact through preview, the editor, and export.

/** A contiguous pipe-table block located within an array of lines. */
export interface TableBlock {
  /** Index of the header line. */
  start: number;
  /** Index of the last body line (inclusive). */
  end: number;
  /** Header cell texts. */
  header: string[];
  /** Body rows, each an array of cell texts. */
  rows: string[][];
}

const isBlank = (line: string) => line.trim() === "";

/** A line carrying at least one unescaped pipe — a candidate table row. */
function containsPipe(line: string): boolean {
  return /(^|[^\\])\|/.test(line);
}

/** Split a pipe row into trimmed, unescaped cell texts. */
export function splitCells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

/** True for a GFM delimiter row, e.g. `| --- | :---: |`. */
export function isDelimiterRow(line: string): boolean {
  if (!containsPipe(line)) return false;
  const cells = splitCells(line);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

/**
 * Locate every pipe-table block in `lines`. A table is a row immediately
 * followed by a delimiter row, then zero or more body rows up to the next
 * blank/non-pipe line.
 */
export function findTableBlocks(lines: string[]): TableBlock[] {
  const blocks: TableBlock[] = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (
      containsPipe(lines[i]) &&
      !isBlank(lines[i]) &&
      isDelimiterRow(lines[i + 1])
    ) {
      const header = splitCells(lines[i]);
      const rows: string[][] = [];
      let j = i + 2;
      while (j < lines.length && !isBlank(lines[j]) && containsPipe(lines[j])) {
        rows.push(splitCells(lines[j]));
        j++;
      }
      blocks.push({ start: i, end: j - 1, header, rows });
      i = j - 1;
    }
  }
  return blocks;
}

/** Set of line indices that belong to any table block (header → last body). */
export function tableLineIndices(lines: string[]): Set<number> {
  const set = new Set<number>();
  for (const b of findTableBlocks(lines)) {
    for (let i = b.start; i <= b.end; i++) set.add(i);
  }
  return set;
}
