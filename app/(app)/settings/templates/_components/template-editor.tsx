"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/catalyst/button";
import { ErrorMessage, Field, Label } from "@/components/catalyst/fieldset";
import { Input } from "@/components/catalyst/input";
import { Select } from "@/components/catalyst/select";
import { Textarea } from "@/components/catalyst/textarea";
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

const CAPTION = "mb-1 block text-xs font-medium text-zinc-500";

/**
 * Create / edit form for a template — name, description, category and the
 * Markdown body, with the body editor and a live preview shown side by side.
 * Built on the Catalyst form primitives (`Field` / `Label` / `Input` /
 * `Select` / `Textarea` / `ErrorMessage`), so validation messages render
 * beneath the field they belong to. In edit mode a version-history panel sits
 * below; create submits then redirects into the new template's editor.
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
  const [state, formAction, isPending] = useActionState<
    TemplateFormState,
    FormData
  >(action, TEMPLATE_FORM_INITIAL);

  // The body is controlled so the live preview can render what's been typed.
  const [content, setContent] = useState(template?.content ?? "");

  return (
    <div className="space-y-8">
      <form action={formAction}>
        {state.error ? (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
          >
            <ExclamationTriangleIcon
              className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">
                {isEdit
                  ? "Couldn’t save your changes"
                  : "Couldn’t create the template"}
              </p>
              <p className="mt-0.5 text-red-800/90 dark:text-red-200/90">
                {state.error}
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <Label>Name</Label>
            <Input
              name="name"
              maxLength={150}
              defaultValue={template?.name ?? ""}
              invalid={!!state.fieldErrors.name}
            />
            {state.fieldErrors.name ? (
              <ErrorMessage>{state.fieldErrors.name}</ErrorMessage>
            ) : null}
          </Field>

          <Field>
            <Label>Category</Label>
            <Select
              name="category"
              defaultValue={template?.category ?? "SOAP"}
              invalid={!!state.fieldErrors.category}
            >
              {TEMPLATE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {CATEGORY_LABEL[category]}
                </option>
              ))}
            </Select>
            {state.fieldErrors.category ? (
              <ErrorMessage>{state.fieldErrors.category}</ErrorMessage>
            ) : null}
          </Field>
        </div>

        <Field className="mt-6">
          <Label>Description</Label>
          <Input
            name="description"
            maxLength={500}
            defaultValue={template?.description ?? ""}
          />
        </Field>

        <Field className="mt-6">
          <Label>Template body (Markdown)</Label>
          <FormattingGuide />

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <div>
              <span className={CAPTION}>Editor</span>
              {/* Controlled so the preview renders live; `name` keeps it part
                  of the form submission. Fixed height to match the preview
                  pane — the Catalyst textarea fills its wrapper. */}
              <Textarea
                name="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                resizable={false}
                className="h-[34rem] font-mono"
              />
            </div>
            <div>
              <span className={CAPTION}>Preview</span>
              <TemplatePreview content={content} />
            </div>
          </div>
          {state.fieldErrors.content ? (
            <ErrorMessage>{state.fieldErrors.content}</ErrorMessage>
          ) : null}
        </Field>

        {isEdit && state.savedAt ? (
          <p className="mt-4 text-sm/6 text-emerald-600 dark:text-emerald-400">
            Changes saved.
          </p>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-x-6">
          <Button href="/settings/templates" plain>
            {isEdit ? "Back to templates" : "Cancel"}
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? "Saving…"
              : isEdit
                ? "Save changes"
                : "Create template"}
          </Button>
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

function RestoreButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" outline disabled={pending}>
      {pending ? "…" : "Restore"}
    </Button>
  );
}
