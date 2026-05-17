"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import type { TemplateSummary } from "@/lib/templates";
import {
  cloneTemplateAction,
  restoreTemplateAction,
  retireTemplateAction,
  setDefaultTemplateAction,
} from "../actions";

const CHIP =
  "rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900";
const CHIP_DANGER =
  "rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/40";

/**
 * One category's templates — each row links into the editor, with clone /
 * set-default / retire / restore actions. Active templates sort above retired
 * ones; the backend already orders each group by name.
 */
export function TemplateList({ items }: { items: TemplateSummary[] }) {
  const ordered = [...items].sort(
    (a, b) => Number(a.retired) - Number(b.retired),
  );

  return (
    <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {ordered.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/settings/templates/${item.id}`}
                className={
                  "truncate font-medium hover:underline" +
                  (item.retired ? " text-zinc-400 dark:text-zinc-500" : "")
                }
              >
                {item.name}
              </Link>
              {item.isDefault ? (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  default
                </span>
              ) : null}
              {item.system ? (
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  starter
                </span>
              ) : null}
              {item.retired ? (
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  retired
                </span>
              ) : null}
            </div>
            <div className="text-xs text-zinc-500">
              {item.description ? `${item.description} · ` : ""}v{item.version}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {item.retired ? (
              <ActionForm action={restoreTemplateAction.bind(null, item.id)}>
                <ActionChip>Restore</ActionChip>
              </ActionForm>
            ) : (
              <>
                {!item.isDefault ? (
                  <ActionForm
                    action={setDefaultTemplateAction.bind(null, item.id)}
                  >
                    <ActionChip>Set default</ActionChip>
                  </ActionForm>
                ) : null}
                <ActionForm action={cloneTemplateAction.bind(null, item.id)}>
                  <ActionChip>Clone</ActionChip>
                </ActionForm>
                <ActionForm
                  action={retireTemplateAction.bind(null, item.id)}
                  confirm={`Retire "${item.name}"? It stays referenceable by history but is hidden from pickers.`}
                >
                  <ActionChip danger>Retire</ActionChip>
                </ActionForm>
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A one-shot form for a bound action — used for the row action buttons. */
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

function ActionChip({
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
      className={danger ? CHIP_DANGER : CHIP}
    >
      {pending ? "…" : children}
    </button>
  );
}
