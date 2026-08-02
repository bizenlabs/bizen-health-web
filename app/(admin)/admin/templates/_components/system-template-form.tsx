"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { Button } from "@/components/catalyst/button";
import { ErrorMessage, Field, Label } from "@/components/catalyst/fieldset";
import { Input } from "@/components/catalyst/input";
import { Select } from "@/components/catalyst/select";
import { Textarea } from "@/components/catalyst/textarea";
import type { SystemTemplate } from "@/lib/system-templates";
import { CATEGORY_LABEL, TEMPLATE_CATEGORIES } from "@/lib/template-categories";
import {
  SPECIALTY_LABEL,
  TEMPLATE_SPECIALTIES,
} from "@/lib/template-specialties";
import {
  activateSystemTemplateAction,
  deactivateSystemTemplateAction,
  publishSystemTemplateAction,
  updateSystemTemplateAction,
} from "../actions";
import {
  SYSTEM_TEMPLATE_FORM_INITIAL,
  type SystemTemplateFormState,
} from "./system-template-form-state";

/**
 * Publish / edit form for an authored system template. Deliberately sparser
 * than the tenant template editor (no variable inserter, no live preview) —
 * this is a platform-operator surface. Bodies follow the same
 * `[placeholder]` / `(instruction)` convention and `{{...}}` variables as
 * tenant templates.
 */
export function SystemTemplateForm({
  template,
}: {
  template?: SystemTemplate;
}) {
  const isEdit = template !== undefined;
  const action = isEdit
    ? updateSystemTemplateAction.bind(null, template.id)
    : publishSystemTemplateAction;
  const [state, formAction, isPending] = useActionState<
    SystemTemplateFormState,
    FormData
  >(action, SYSTEM_TEMPLATE_FORM_INITIAL);

  return (
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
                : "Couldn’t publish the template"}
            </p>
            <p className="mt-0.5 text-red-800/90 dark:text-red-200/90">
              {state.error}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-3">
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

        <Field>
          <Label>Specialty</Label>
          <Select
            name="specialty"
            defaultValue={template?.specialty ?? ""}
            invalid={!!state.fieldErrors.specialty}
          >
            <option value="">General</option>
            {TEMPLATE_SPECIALTIES.map((specialty) => (
              <option key={specialty} value={specialty}>
                {SPECIALTY_LABEL[specialty]}
              </option>
            ))}
          </Select>
          {state.fieldErrors.specialty ? (
            <ErrorMessage>{state.fieldErrors.specialty}</ErrorMessage>
          ) : null}
        </Field>

        <Field className="sm:col-span-3">
          <Label>Description</Label>
          <Input
            name="description"
            maxLength={500}
            defaultValue={template?.description ?? ""}
          />
        </Field>

        <Field className="sm:col-span-3">
          <Label>Template body (Markdown)</Label>
          <Textarea
            name="content"
            rows={18}
            defaultValue={template?.content ?? ""}
            invalid={!!state.fieldErrors.content}
            className="font-mono text-sm"
          />
          {state.fieldErrors.content ? (
            <ErrorMessage>{state.fieldErrors.content}</ErrorMessage>
          ) : null}
        </Field>

        <Field className="sm:col-span-3">
          <Label>Example output (optional)</Label>
          <Textarea
            name="exampleOutput"
            rows={12}
            defaultValue={template?.exampleOutput ?? ""}
            className="font-mono text-sm"
          />
        </Field>
      </div>

      {isEdit && state.savedAt ? (
        <p className="mt-4 text-sm/6 text-emerald-600 dark:text-emerald-400">
          Changes saved.
        </p>
      ) : null}

      <div className="mt-6 flex items-center justify-end gap-x-6">
        <Button href="/admin/templates" plain>
          {isEdit ? "Back to templates" : "Cancel"}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : isEdit ? "Save changes" : "Publish template"}
        </Button>
      </div>
    </form>
  );
}

/** Unpublish / republish toggle for an authored system template. */
export function PublishStatusToggle({
  template,
}: {
  template: SystemTemplate;
}) {
  const action = template.active
    ? deactivateSystemTemplateAction.bind(null, template.id)
    : activateSystemTemplateAction.bind(null, template.id);
  const confirmMessage = template.active
    ? `Unpublish "${template.name}"? It disappears from every clinic's template catalogue (existing clones are unaffected).`
    : `Republish "${template.name}"? It becomes visible to every clinic again.`;

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <ToggleButton active={template.active} />
    </form>
  );
}

function ToggleButton({ active }: { active: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" outline disabled={pending}>
      {pending ? "…" : active ? "Unpublish" : "Republish"}
    </Button>
  );
}
