"use client";

import { useFormStatus } from "react-dom";
import { GlobeAltIcon } from "@heroicons/react/20/solid";
import { promoteTemplateAction } from "../actions";

/**
 * Super-admin-only action: publish a tenant template into the global
 * system-template library, making it available to every clinic. Rendered only
 * when the server page has already verified the role — the Server Action
 * re-verifies it regardless.
 */
export function PromoteButton({
  templateId,
  templateName,
}: {
  templateId: string;
  templateName: string;
}) {
  return (
    <form
      action={promoteTemplateAction.bind(null, templateId)}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Publish "${templateName}" to the global template library? Every clinic on the platform will see it as a system template.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
    >
      <GlobeAltIcon className="size-3.5" />
      {pending ? "Publishing…" : "Promote to platform library"}
    </button>
  );
}
