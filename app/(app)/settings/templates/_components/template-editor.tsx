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
const CAPTION = "mb-1 block text-xs font-medium text-zinc-500";
const PRIMARY =
  "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";
const SECONDARY =
  "rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900";

/**
 * Create / edit form for a template — name, description, category and the
 * Markdown body, with the body editor and a live preview shown side by side.
 * In edit mode a version-history panel sits below, each past version
 * restorable in one click. Create submits then redirects into the new
 * template's editor (handled server-side).
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

  return (
    <div className="space-y-8">
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
          <label htmlFor="content" className={LABEL}>
            Template body (Markdown)
          </label>

          <FormattingGuide />

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div>
              <span className={CAPTION}>Editor</span>
              {/* Controlled so the preview renders live; `name` keeps it part
                  of the form submission. */}
              <textarea
                id="content"
                name="content"
                rows={22}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className={`${INPUT} font-mono`}
              />
            </div>
            <div>
              <span className={CAPTION}>Preview</span>
              <TemplatePreview content={content} />
            </div>
          </div>
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

/** Legend for the Markdown subset and the template DSL markers. */
function FormattingGuide() {
  return (
    <div className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/40">
      <p className="font-medium text-zinc-500">Formatting</p>
      <ul className="mt-1.5 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        <li className="flex items-baseline gap-2">
          <code className="rounded bg-zinc-100 px-1 font-mono dark:bg-zinc-800">
            ## Heading Section
          </code>
          <span className="text-zinc-500">section heading</span>
        </li>
        <li className="flex items-baseline gap-2">
          <code className="rounded bg-zinc-100 px-1 font-mono dark:bg-zinc-800">
            **Bold** Label
          </code>
          <span className="text-zinc-500">bold label</span>
        </li>
        <li className="flex items-baseline gap-2">
          <code className="rounded bg-amber-100 px-1 font-mono text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            [placeholder]
          </code>
          <span className="text-zinc-500">AI fills this in</span>
        </li>
        <li className="flex items-baseline gap-2">
          <code className="rounded px-1 font-mono text-zinc-400 italic dark:text-zinc-500">
            (instruction)
          </code>
          <span className="text-zinc-500">
            AI guidance — not kept in the note
          </span>
        </li>
      </ul>
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
