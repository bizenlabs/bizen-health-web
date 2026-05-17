"use client";

import Link from "next/link";
import { DocumentDuplicateIcon } from "@heroicons/react/20/solid";
import { useFormStatus } from "react-dom";
import { CATEGORY_LABEL } from "@/lib/template-categories";
import type { TemplateSummary } from "@/lib/templates";
import {
  cloneTemplateAction,
  restoreTemplateAction,
  retireTemplateAction,
  setDefaultTemplateAction,
} from "../actions";

/**
 * One template tile in the browse grid — ported from the med-scribe reference
 * app's `TemplateCard`, rebuilt with the platform's Tailwind conventions. The
 * title links into the editor; clone / set-default / retire actions sit in a
 * footer bar that the card reveals on hover or keyboard focus.
 */
export function TemplateCard({ template }: { template: TemplateSummary }) {
  const retired = template.retired;

  return (
    <div
      className={
        "group relative flex flex-col rounded-xl border p-4 transition-all focus-within:border-zinc-300 hover:border-zinc-300 hover:shadow-sm dark:focus-within:border-zinc-600 dark:hover:border-zinc-600 " +
        (retired
          ? "border-zinc-200 bg-zinc-50/60 dark:border-zinc-800 dark:bg-zinc-900/40"
          : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/50")
      }
    >
      {/* Header — title links into the editor */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link
          href={`/settings/templates/${template.id}`}
          className={
            "text-sm font-medium hover:underline " +
            (retired
              ? "text-zinc-400 dark:text-zinc-500"
              : "text-zinc-900 dark:text-white")
          }
        >
          {template.name}
        </Link>
      </div>

      {/* Category */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        <Badge>{CATEGORY_LABEL[template.category]}</Badge>
      </div>

      {/* Description */}
      {template.description ? (
        <p className="mb-3 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
          {template.description}
        </p>
      ) : null}

      {/* Footer — status badges + relative updated date */}
      <div className="mt-auto flex items-center gap-2 pt-1">
        {template.isDefault ? <Badge tone="emerald">Default</Badge> : null}
        {template.system ? <Badge tone="zinc">Starter</Badge> : null}
        {retired ? <Badge tone="zinc">Retired</Badge> : null}
        <span className="ml-auto text-[10px] text-zinc-400 dark:text-zinc-500">
          v{template.version} · {formatRelativeDate(template.updatedAt)}
        </span>
      </div>

      {/* Action bar — revealed on hover / focus */}
      <div className="mt-3 flex items-center gap-2 border-t border-zinc-100 pt-3 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 dark:border-zinc-700/60">
        {retired ? (
          <ActionForm action={restoreTemplateAction.bind(null, template.id)}>
            <ActionButton>Restore</ActionButton>
          </ActionForm>
        ) : (
          <>
            {!template.isDefault ? (
              <ActionForm
                action={setDefaultTemplateAction.bind(null, template.id)}
              >
                <ActionButton>Set default</ActionButton>
              </ActionForm>
            ) : null}
            <ActionForm action={cloneTemplateAction.bind(null, template.id)}>
              <ActionButton>
                <DocumentDuplicateIcon className="size-3.5" />
                Clone
              </ActionButton>
            </ActionForm>
            <ActionForm
              action={retireTemplateAction.bind(null, template.id)}
              confirm={`Retire "${template.name}"? It stays referenceable by history but is hidden from pickers.`}
            >
              <ActionButton danger>Retire</ActionButton>
            </ActionForm>
          </>
        )}
      </div>
    </div>
  );
}

/** ISO timestamp → a compact relative label, e.g. "Today", "3d ago". */
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const diffDays = Math.floor(
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}

function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "emerald" | "zinc";
}) {
  const styles = {
    default: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    zinc: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

/** A one-shot form for a bound server action. */
function ActionForm({
  action,
  confirm: confirmMessage,
  children,
}: {
  action: () => void | Promise<void>;
  confirm?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirmMessage && !window.confirm(confirmMessage)) {
          e.preventDefault();
        }
      }}
    >
      {children}
    </form>
  );
}

function ActionButton({
  children,
  danger = false,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={
        "flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 " +
        (danger
          ? "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/40"
          : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900")
      }
    >
      {pending ? "…" : children}
    </button>
  );
}
