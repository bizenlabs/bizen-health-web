"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CATEGORY_LABEL, TEMPLATE_CATEGORIES } from "@/lib/template-categories";
import type { TemplateDetail, TemplateVersion } from "@/lib/templates";
import {
  createTemplateAction,
  restoreTemplateVersionAction,
  updateTemplateAction,
} from "../actions";
import {
  TEMPLATE_FORM_INITIAL,
  type TemplateFormState,
} from "./template-editor-state";
import { TemplatePreview } from "./template-preview";

const INPUT =
  "mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent";
const LABEL = "block text-xs text-zinc-500";
const PRIMARY =
  "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";
const SECONDARY =
  "rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900";

/**
 * Create / edit form for a template — name, description, category and the
 * Markdown body. In edit mode a version-history panel sits alongside, each
 * past version restorable in one click. Create submits then redirects into
 * the new template's editor (handled server-side).
 */
export function TemplateEditor({
  template,
  versions,
}: {
  template?: TemplateDetail;
  versions?: TemplateVersion[];
}) {
  const isEdit = template !== undefined;
  const action = isEdit
    ? updateTemplateAction.bind(null, template.id)
    : createTemplateAction;
  const [state, formAction] = useActionState<TemplateFormState, FormData>(
    action,
    TEMPLATE_FORM_INITIAL,
  );

  // The body is controlled so the live preview can render what's been typed.
  const [content, setContent] = useState(template?.content ?? "");
  const [bodyMode, setBodyMode] = useState<"write" | "preview">("write");

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <form action={formAction}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className={LABEL}>
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={150}
              defaultValue={template?.name ?? ""}
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="category" className={LABEL}>
              Category
            </label>
            <select
              id="category"
              name="category"
              defaultValue={template?.category ?? "SOAP"}
              className={INPUT}
            >
              {TEMPLATE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABEL[category]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="description" className={LABEL}>
            Description
          </label>
          <input
            id="description"
            name="description"
            type="text"
            maxLength={500}
            defaultValue={template?.description ?? ""}
            className={INPUT}
          />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <label htmlFor="content" className={LABEL}>
              Template body (Markdown)
            </label>
            <div className="flex gap-0.5 rounded-md border border-zinc-200 p-0.5 dark:border-zinc-800">
              <BodyModeTab
                label="Write"
                active={bodyMode === "write"}
                onClick={() => setBodyMode("write")}
              />
              <BodyModeTab
                label="Preview"
                active={bodyMode === "preview"}
                onClick={() => setBodyMode("preview")}
              />
            </div>
          </div>
          {/* The textarea stays mounted (just hidden) in preview mode so it
              still carries the `content` field when the form is submitted. */}
          <textarea
            id="content"
            name="content"
            rows={22}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`${INPUT} font-mono ${
              bodyMode === "preview" ? "hidden" : ""
            }`}
          />
          {bodyMode === "preview" ? (
            <TemplatePreview content={content} />
          ) : null}
          <p className="mt-1 text-xs text-zinc-500">
            Markdown. Use{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              [placeholder]
            </code>{" "}
            for a field to fill and{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              (instruction)
            </code>{" "}
            for authoring guidance not kept in the finished note.
          </p>
        </div>

        {state.error ? (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400">
            {state.error}
          </p>
        ) : null}
        {isEdit && state.savedAt ? (
          <p className="mt-3 text-xs text-emerald-600 dark:text-emerald-400">
            Changes saved.
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <SubmitButton label={isEdit ? "Save changes" : "Create template"} />
          <Link href="/settings/templates" className={SECONDARY}>
            {isEdit ? "Back to templates" : "Cancel"}
          </Link>
        </div>
      </form>

      {isEdit ? (
        <VersionHistory templateId={template.id} versions={versions ?? []} />
      ) : null}
    </div>
  );
}

function VersionHistory({
  templateId,
  versions,
}: {
  templateId: string;
  versions: TemplateVersion[];
}) {
  return (
    <aside>
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
        Version history
      </h2>
      {versions.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          No earlier versions yet — saving an edit records one.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {versions.map((version) => (
            <li
              key={version.versionNumber}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">
                  v{version.versionNumber} · {version.name}
                </div>
                <div className="text-xs text-zinc-500">
                  {new Date(version.createdAt).toLocaleString()}
                </div>
              </div>
              <form
                action={restoreTemplateVersionAction.bind(
                  null,
                  templateId,
                  version.versionNumber,
                )}
                onSubmit={(e) => {
                  if (
                    !window.confirm(
                      `Restore v${version.versionNumber}? The current content is saved as a new version first.`,
                    )
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <RestoreButton />
              </form>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

function BodyModeTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded px-2 py-0.5 text-xs font-medium " +
        (active
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200")
      }
    >
      {label}
    </button>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={PRIMARY}>
      {pending ? "Saving…" : label}
    </button>
  );
}

function RestoreButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
    >
      {pending ? "…" : "Restore"}
    </button>
  );
}
