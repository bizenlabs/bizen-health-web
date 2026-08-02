import type { ReactNode } from "react";
import { findTableBlocks } from "@/lib/markdown-table";
import { variableLabel } from "@/lib/template-variables";

/**
 * Renders a template body the way it reads as a finished note — a lightweight,
 * dependency-free pass over the small Markdown subset templates use (headings,
 * bullets, bold) plus the two template-DSL markers:
 *
 *   {{variable}}   patient/date data filled at dictation time — green chip
 *   [placeholder]  a field to fill — shown as a highlighted chip
 *   (instruction)  authoring guidance not kept in the finished note — muted
 *
 * Deliberately not a full CommonMark renderer; it only needs to make a
 * clinical note template legible while it is being authored. Output is built
 * purely from React elements — no raw HTML is injected — so it is XSS-safe.
 */

// Splits a line into plain text and inline markers, keeping the markers.
const INLINE = /(\{\{[\s\w.]+\}\}|\*\*[^*\n]+\*\*|\[[^\]\n]+\]|\([^)\n]+\))/g;
const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if (part.startsWith("{{") && part.endsWith("}}")) {
      return (
        <span
          key={i}
          className="rounded bg-emerald-100 px-1 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
        >
          {variableLabel(part.slice(2, -2))}
        </span>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("[") && part.endsWith("]")) {
      return (
        <span
          key={i}
          className="rounded bg-amber-100 px-1 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
        >
          {part.slice(1, -1)}
        </span>
      );
    }
    if (part.startsWith("(") && part.endsWith(")")) {
      return (
        <span key={i} className="text-zinc-400 italic dark:text-zinc-500">
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function PreviewLine({ line }: { line: string }) {
  if (line.trim() === "") return <div className="h-3" aria-hidden />;

  const heading = line.match(HEADING);
  if (heading) {
    const level = heading[1].length;
    const text = renderInline(heading[2]);
    if (level === 1) {
      return <div className="mt-3 mb-1 text-base font-semibold">{text}</div>;
    }
    if (level === 2) {
      return <div className="mt-3 mb-0.5 text-sm font-semibold">{text}</div>;
    }
    return (
      <div className="mt-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {text}
      </div>
    );
  }

  const bullet = line.match(BULLET);
  if (bullet) {
    return (
      <div className="flex gap-2">
        <span aria-hidden className="text-zinc-400 dark:text-zinc-500">
          •
        </span>
        <span>{renderInline(bullet[1])}</span>
      </div>
    );
  }

  return <p className="leading-relaxed">{renderInline(line)}</p>;
}

// A GFM pipe table — rendered as a real bordered table so the preview reads
// the way the finished note (and its PDF/DOCX export) will. Cell text runs
// through `renderInline`, so `[placeholder]` chips and **bold** show in cells.
function PreviewTable({
  header,
  rows,
}: {
  header: string[];
  rows: string[][];
}) {
  const cols = header.length;
  return (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th
                key={i}
                className="border border-zinc-200 bg-zinc-50 px-2 py-1 text-left font-semibold dark:border-zinc-700 dark:bg-zinc-800/60"
              >
                {renderInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => (
                <td
                  key={c}
                  className="border border-zinc-200 px-2 py-1 align-top dark:border-zinc-700"
                >
                  {renderInline(row[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TemplatePreview({ content }: { content: string }) {
  // Normalise CRLF/CR — browsers submit <textarea> values with \r\n, and a
  // stray \r breaks the `$` anchor in the line patterns.
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const tables = findTableBlocks(lines);
  // Map each table's start line to the block, and collect the lines it spans.
  const tableByStart = new Map(tables.map((t) => [t.start, t]));
  const inTable = new Set<number>();
  for (const t of tables) {
    for (let i = t.start; i <= t.end; i++) inTable.add(i);
  }

  const nodes: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const table = tableByStart.get(i);
    if (table) {
      nodes.push(
        <PreviewTable key={i} header={table.header} rows={table.rows} />,
      );
      continue;
    }
    if (inTable.has(i)) continue; // delimiter/body lines consumed by the table
    nodes.push(<PreviewLine key={i} line={lines[i]} />);
  }

  return (
    <div className="mt-1 h-[34rem] w-full overflow-auto rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
      {content.trim() === "" ? (
        <p className="text-zinc-400 dark:text-zinc-500">
          Nothing to preview yet — type a template body to see it here.
        </p>
      ) : (
        <div className="space-y-1">{nodes}</div>
      )}
    </div>
  );
}
