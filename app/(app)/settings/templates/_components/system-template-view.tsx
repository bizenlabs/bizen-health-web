"use client";

import { useFormStatus } from "react-dom";
import {
  DocumentDuplicateIcon,
  LockClosedIcon,
} from "@heroicons/react/20/solid";
import { Button } from "@/components/catalyst/button";
import type { TemplateDetail } from "@/lib/templates";
import { cloneTemplateAction } from "../actions";
import { TemplatePreview } from "./template-preview";

/**
 * Read-only view of a platform-published (system) template. A clinic cannot
 * edit one in place — the only mutating action is "Clone to customize", which
 * makes an editable tenant-owned copy and redirects into its editor.
 */
export function SystemTemplateView({ template }: { template: TemplateDetail }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <LockClosedIcon
          className="mt-0.5 size-5 shrink-0 text-zinc-400"
          aria-hidden="true"
        />
        <div>
          <p className="font-medium text-zinc-700 dark:text-zinc-200">
            Published by the platform — read-only
          </p>
          <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">
            System templates stay in sync across all clinics and can’t be edited
            here. Clone it to make an editable copy you own.
          </p>
        </div>
      </div>

      <div>
        <span className="mb-1 block text-xs font-medium text-zinc-500">
          Template body
        </span>
        <TemplatePreview content={template.content ?? ""} />
      </div>

      <div className="flex items-center justify-end gap-x-6">
        <Button href="/settings/templates" plain>
          Back to templates
        </Button>
        <form action={cloneTemplateAction.bind(null, template.id)}>
          <CloneButton />
        </form>
      </div>
    </div>
  );
}

function CloneButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      <DocumentDuplicateIcon data-slot="icon" />
      {pending ? "Cloning…" : "Clone to customize"}
    </Button>
  );
}
