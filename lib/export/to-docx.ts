import type { ILevelsOptions } from "docx";
import type { Block, InlineRun, ListItem } from "./blocks";

// Renders the format-agnostic block model (see `blocks.ts`) to a Word
// (.docx) Blob using the `docx` library. `docx` is imported dynamically so it
// stays out of the main client bundle — export is a rare, on-demand action.

export type DocMeta = {
  title: string;
  // A preformatted line shown under the title (e.g. the started-at timestamp).
  subtitle?: string;
};

const MONO = "Courier New";

export async function blocksToDocxBlob(
  blocks: Block[],
  meta: DocMeta,
): Promise<Blob> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    LevelFormat,
    AlignmentType,
    BorderStyle,
  } = await import("docx");

  // Each ordered list gets its own numbering reference so it restarts at its
  // own `start` rather than continuing the previous list's count.
  type NumberingConfig = {
    reference: string;
    levels: ILevelsOptions[];
  };
  const numbering: NumberingConfig[] = [];
  let orderedSeq = 0;

  const orderedLevels = (start: number): ILevelsOptions[] =>
    Array.from({ length: 6 }, (_, i) => ({
      level: i,
      format: LevelFormat.DECIMAL,
      text: `%${i + 1}.`,
      alignment: AlignmentType.START,
      ...(i === 0 ? { start } : {}),
      style: {
        paragraph: {
          indent: { left: 720 * (i + 1), hanging: 360 },
        },
      },
    }));

  // --- inline runs ------------------------------------------------------
  // A run's text may carry hardBreak newlines; split so each continuation
  // line gets a `break` (docx inserts the break before the text).
  function toTextRuns(run: InlineRun): InstanceType<typeof TextRun>[] {
    const lines = run.text.split("\n");
    return lines.map(
      (line, i) =>
        new TextRun({
          text: line,
          break: i > 0 ? 1 : undefined,
          bold: run.bold,
          italics: run.italic,
          strike: run.strike,
          underline: run.underline ? {} : undefined,
          font: run.code ? MONO : undefined,
        }),
    );
  }

  const children = (runs: InlineRun[]) => runs.flatMap(toTextRuns);

  // --- blocks -----------------------------------------------------------
  const HEADINGS = [
    HeadingLevel.HEADING_1,
    HeadingLevel.HEADING_2,
    HeadingLevel.HEADING_3,
    HeadingLevel.HEADING_4,
    HeadingLevel.HEADING_5,
    HeadingLevel.HEADING_6,
  ];

  // `list` context threads the active ordered-numbering reference and depth
  // through nested lists so paragraphs get the right bullet / number + indent.
  type ListCtx = {
    ordered: boolean;
    reference?: string;
    level: number;
  };

  function listFormatting(ctx: ListCtx) {
    return ctx.ordered
      ? { numbering: { reference: ctx.reference!, level: ctx.level } }
      : { bullet: { level: ctx.level } };
  }

  // A grey left bar drawn on every paragraph of a block quote.
  const QUOTE_BORDER = {
    left: { style: BorderStyle.SINGLE, size: 12, color: "D4D4D8", space: 12 },
  };

  function renderBlock(
    block: Block,
    opts: { indent?: number; list?: ListCtx; quote?: boolean } = {},
  ): InstanceType<typeof Paragraph>[] {
    const indent = opts.indent ? { indent: { left: opts.indent } } : {};
    const quote = opts.quote ? { border: QUOTE_BORDER } : {};

    switch (block.kind) {
      case "heading":
        return [
          new Paragraph({
            heading: HEADINGS[block.level - 1],
            children: children(block.runs),
            ...indent,
            ...quote,
          }),
        ];

      case "paragraph":
        return [
          new Paragraph({
            children: children(block.runs),
            spacing: { after: 120 },
            ...(opts.list ? listFormatting(opts.list) : indent),
            ...quote,
          }),
        ];

      case "blockquote":
        // Indent the quote and draw a left rule on each of its paragraphs.
        return block.children.flatMap((child) =>
          renderBlock(child, { indent: (opts.indent ?? 0) + 480, quote: true }),
        );

      case "list":
        return renderList(block, opts.list?.level ?? 0);

      case "codeBlock": {
        const lines = block.text.split("\n");
        return [
          new Paragraph({
            shading: { fill: "F4F4F5" },
            spacing: { after: 120 },
            ...indent,
            children: lines.map(
              (line, i) =>
                new TextRun({
                  text: line || " ",
                  font: MONO,
                  size: 18,
                  break: i > 0 ? 1 : undefined,
                }),
            ),
          }),
        ];
      }

      case "rule":
        return [
          new Paragraph({
            spacing: { before: 120, after: 120 },
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: "A1A1AA",
                space: 1,
              },
            },
          }),
        ];
    }
  }

  function renderList(
    list: Extract<Block, { kind: "list" }>,
    level: number,
  ): InstanceType<typeof Paragraph>[] {
    let reference: string | undefined;
    if (list.ordered) {
      reference = `ol-${orderedSeq++}`;
      numbering.push({ reference, levels: orderedLevels(list.start) });
    }
    const ctx: ListCtx = { ordered: list.ordered, reference, level };

    const out: InstanceType<typeof Paragraph>[] = [];
    for (const item of list.items) {
      out.push(...renderItem(item, ctx, level));
    }
    return out;
  }

  function renderItem(
    item: ListItem,
    ctx: ListCtx,
    level: number,
  ): InstanceType<typeof Paragraph>[] {
    const out: InstanceType<typeof Paragraph>[] = [];
    let first = true;
    for (const block of item) {
      if (block.kind === "list") {
        // Nested list — render one level deeper.
        out.push(...renderList(block, level + 1));
        continue;
      }
      // The first paragraph of the item carries the bullet / number; any
      // further paragraphs in the same item are indented to align under it.
      if (first) {
        out.push(...renderBlock(block, { list: ctx }));
        first = false;
      } else {
        out.push(...renderBlock(block, { indent: 720 * (level + 1) }));
      }
    }
    return out;
  }

  // --- document ---------------------------------------------------------
  const body: InstanceType<typeof Paragraph>[] = [];

  body.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: meta.title })],
    }),
  );
  if (meta.subtitle) {
    body.push(
      new Paragraph({
        spacing: { after: 240 },
        children: [
          new TextRun({ text: meta.subtitle, color: "71717A", size: 20 }),
        ],
      }),
    );
  }

  for (const block of blocks) {
    body.push(...renderBlock(block));
  }

  const doc = new Document({
    numbering: { config: numbering },
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [{ children: body }],
  });

  return Packer.toBlob(doc);
}
