"use client";

import { useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import type { Editor } from "@tiptap/react";
import clsx from "clsx";
import { Download, FileText, Loader2 } from "lucide-react";
import { type ExportFormat, exportEditorDocument } from "@/lib/export";

// Export dropdown for the dictation editor — converts the live note content
// to a formatted PDF or Word document and downloads it. Sits in the editor
// toolbar next to Copy. The conversion runs client-side off the editor's
// structured content so unsaved edits and all formatting are preserved.

export function DictationExportMenu({
  editor,
  title,
  subtitle,
  disabled = false,
}: {
  editor: Editor;
  // Display title used for the document heading + download filename.
  title: string;
  // A line shown under the title (the dictation's started-at timestamp).
  subtitle?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState(false);

  async function handleExport(format: ExportFormat) {
    if (busy) return;
    setBusy(format);
    setError(false);
    try {
      await exportEditorDocument(editor, format, { title, subtitle });
    } catch {
      // Generation is best-effort; surface a transient marker rather than
      // throwing across the UI.
      setError(true);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Menu as="div" className="relative">
      <div className="group relative">
        <MenuButton
          aria-label="Export note"
          disabled={disabled || busy !== null}
          className={clsx(
            "flex h-8 items-center gap-1 rounded-md px-1.5 transition-colors disabled:pointer-events-none disabled:opacity-30",
            error
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
          )}
        >
          {busy ? (
            <Loader2
              aria-hidden="true"
              className="size-4 animate-spin"
              strokeWidth={2.25}
            />
          ) : (
            <Download
              aria-hidden="true"
              className="size-4"
              strokeWidth={2.25}
            />
          )}
        </MenuButton>
        <span className="pointer-events-none absolute right-0 bottom-full z-30 mb-1.5 flex items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-medium whitespace-nowrap text-white opacity-0 shadow-md transition-opacity duration-100 group-hover:opacity-100 dark:bg-zinc-700">
          {error ? "Export failed — try again" : "Export"}
        </span>
      </div>

      <MenuItems
        anchor="bottom end"
        className="z-40 mt-1.5 w-44 origin-top-right rounded-lg border border-zinc-200 bg-white p-1 shadow-lg ring-1 ring-zinc-950/5 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:ring-white/10"
      >
        <ExportItem
          icon={<FileText className="size-4" strokeWidth={2} />}
          label="PDF document"
          hint=".pdf"
          onClick={() => void handleExport("pdf")}
        />
        <ExportItem
          icon={<FileText className="size-4" strokeWidth={2} />}
          label="Word document"
          hint=".docx"
          onClick={() => void handleExport("docx")}
        />
      </MenuItems>
    </Menu>
  );
}

function ExportItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <MenuItem>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-zinc-700 transition-colors data-focus:bg-zinc-100 dark:text-zinc-200 dark:data-focus:bg-zinc-700/60"
      >
        <span className="text-zinc-400 dark:text-zinc-500">{icon}</span>
        <span className="flex-1">{label}</span>
        <span className="font-mono text-[10px] tracking-wide text-zinc-400 dark:text-zinc-500">
          {hint}
        </span>
      </button>
    </MenuItem>
  );
}
