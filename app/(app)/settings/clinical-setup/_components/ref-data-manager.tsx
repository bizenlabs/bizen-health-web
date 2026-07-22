"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { RefItem, RegisterKey } from "@/lib/reference-data";
import {
  createRefItemAction,
  restoreRefItemAction,
  retireRefItemAction,
  updateRefItemAction,
} from "../actions";
import { REF_DATA_INITIAL } from "./ref-data-state";

const INPUT =
  "mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent";
const LABEL = "block text-xs text-zinc-500";
const PRIMARY =
  "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";
const SECONDARY =
  "rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900";
const CHIP =
  "rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900";
const CHIP_DANGER =
  "rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/40";

/**
 * The editor for one reference-data register — list, inline add, inline edit,
 * retire/restore. Generic over the register: `registerKey` routes the Server
 * Actions, `singular` (e.g. "visit type") drives the user-facing copy.
 */
export function RefDataManager({
  registerKey,
  singular,
  items,
}: {
  registerKey: RegisterKey;
  singular: string;
  items: RefItem[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  // Keep retired entries grouped below the active ones; the backend already
  // orders each group by name, and a stable sort preserves that.
  const ordered = [...items].sort(
    (a, b) => Number(a.retired) - Number(b.retired),
  );

  return (
    <div className="mt-3 space-y-6">
      {ordered.length === 0 ? (
        <p className="text-sm text-zinc-500">No {singular}s yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {ordered.map((item) =>
            editingId === item.id ? (
              <li key={item.id} className="px-4 py-3">
                <EditItemForm
                  registerKey={registerKey}
                  item={item}
                  onDone={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        "truncate font-medium" +
                        (item.retired
                          ? " text-zinc-400 dark:text-zinc-500"
                          : "")
                      }
                    >
                      {item.name}
                    </span>
                    {item.retired ? (
                      <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        retired
                      </span>
                    ) : null}
                  </div>
                  {item.description ? (
                    <div className="text-xs text-zinc-500">
                      {item.description}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {item.retired ? (
                    <ActionForm
                      action={restoreRefItemAction.bind(
                        null,
                        registerKey,
                        item.id,
                      )}
                    >
                      <ActionChip>Restore</ActionChip>
                    </ActionForm>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditingId(item.id)}
                        className={CHIP}
                      >
                        Edit
                      </button>
                      <ActionForm
                        action={retireRefItemAction.bind(
                          null,
                          registerKey,
                          item.id,
                        )}
                        confirm={`Retire "${item.name}"? It stays on historical records but is hidden when creating new ones.`}
                      >
                        <ActionChip danger>Retire</ActionChip>
                      </ActionForm>
                    </>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
      )}

      <AddItemForm registerKey={registerKey} singular={singular} />
    </div>
  );
}

function EditItemForm({
  registerKey,
  item,
  onDone,
}: {
  registerKey: RegisterKey;
  item: RefItem;
  onDone: () => void;
}) {
  const [state, formAction] = useActionState(
    updateRefItemAction.bind(null, registerKey, item.id),
    REF_DATA_INITIAL,
  );

  // The action stamps `savedAt` on success — leave edit mode so the row falls
  // back to its (now revalidated) display form.
  useEffect(() => {
    if (state.savedAt) onDone();
  }, [state.savedAt, onDone]);

  return (
    <form action={formAction}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`name-${item.id}`} className={LABEL}>
            Name
          </label>
          <input
            id={`name-${item.id}`}
            name="name"
            type="text"
            required
            maxLength={100}
            defaultValue={item.name}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor={`desc-${item.id}`} className={LABEL}>
            Description
          </label>
          <input
            id={`desc-${item.id}`}
            name="description"
            type="text"
            maxLength={500}
            defaultValue={item.description ?? ""}
            className={INPUT}
          />
        </div>
      </div>

      {state.error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <SubmitButton label="Save" pendingLabel="Saving…" />
        <button type="button" onClick={onDone} className={SECONDARY}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function AddItemForm({
  registerKey,
  singular,
}: {
  registerKey: RegisterKey;
  singular: string;
}) {
  const [state, formAction] = useActionState(
    createRefItemAction.bind(null, registerKey),
    REF_DATA_INITIAL,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the inputs after a successful add so the next entry starts fresh.
  useEffect(() => {
    if (state.savedAt) formRef.current?.reset();
  }, [state.savedAt]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-md border border-dashed border-zinc-300 p-4 dark:border-zinc-700"
    >
      <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        Add {singular}
      </h3>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`add-${registerKey}-name`} className={LABEL}>
            Name
          </label>
          <input
            id={`add-${registerKey}-name`}
            name="name"
            type="text"
            required
            maxLength={100}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor={`add-${registerKey}-description`} className={LABEL}>
            Description
          </label>
          <input
            id={`add-${registerKey}-description`}
            name="description"
            type="text"
            maxLength={500}
            className={INPUT}
          />
        </div>
      </div>

      {state.error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <div className="mt-3">
        <SubmitButton label={`Add ${singular}`} pendingLabel="Adding…" />
      </div>
    </form>
  );
}

/** A one-shot form for a bound action — used for the retire / restore buttons. */
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

function SubmitButton({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={PRIMARY}>
      {pending ? pendingLabel : label}
    </button>
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
