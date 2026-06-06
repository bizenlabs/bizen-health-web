import type { Editor } from "@tiptap/react";
import { documentToBlocks } from "./blocks";
import type { DocMeta } from "./to-docx";

export type ExportFormat = "pdf" | "docx";

export { isEmptyDocument, documentToBlocks } from "./blocks";
export type { DocMeta } from "./to-docx";

const EXT: Record<ExportFormat, string> = { pdf: "pdf", docx: "docx" };

// Build a filesystem-safe download name from the dictation's display title.
function fileName(title: string, format: ExportFormat): string {
  const base =
    title
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "") // characters illegal on Windows
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 80) || "dictation";
  return `${base}.${EXT[format]}`;
}

function triggerDownload(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the navigation to the blob URL has started.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// Convert the live editor content to the chosen format and download it. The
// renderer modules (and their heavy dependencies) are loaded lazily here so
// they're only pulled in when a clinician actually exports.
export async function exportEditorDocument(
  editor: Editor,
  format: ExportFormat,
  meta: DocMeta,
): Promise<void> {
  const blocks = documentToBlocks(editor.getJSON());

  const blob =
    format === "docx"
      ? await (await import("./to-docx")).blocksToDocxBlob(blocks, meta)
      : await (await import("./to-pdf")).blocksToPdfBlob(blocks, meta);

  triggerDownload(blob, fileName(meta.title, format));
}
