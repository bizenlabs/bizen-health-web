"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { IdentifierType, PatientDetail } from "@/lib/patients";
import {
  addIdentifierAction,
  setPreferredIdentifierAction,
  voidIdentifierAction,
} from "../actions";

type AddState = { error: string | null };
const ADD_INITIAL: AddState = { error: null };

export function ManageIdentifiers({
  patient,
  identifierTypes,
}: {
  patient: PatientDetail;
  identifierTypes: IdentifierType[];
}) {
  const active = patient.identifiers;
  const hasPreferred = active.some((i) => i.preferred);

  return (
    <div className="space-y-6">
      {active.length === 0 ? (
        <p className="text-sm text-zinc-500">No identifiers attached.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {active.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{i.identifier}</div>
                <div className="text-xs text-zinc-500">{i.typeName}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {i.preferred ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    preferred
                  </span>
                ) : (
                  <PromoteButton patientId={patient.id} identifierId={i.id} />
                )}
                <RemoveButton
                  patientId={patient.id}
                  identifierId={i.id}
                  warnUnsetPreferred={i.preferred && hasPreferred}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <AddIdentifierForm
        patientId={patient.id}
        identifierTypes={identifierTypes}
        canDefaultPreferred={!hasPreferred}
      />
    </div>
  );
}

function PromoteButton({
  patientId,
  identifierId,
}: {
  patientId: string;
  identifierId: string;
}) {
  const action = setPreferredIdentifierAction.bind(
    null,
    patientId,
    identifierId,
  );
  return (
    <form action={action}>
      <SubmitChip>Make preferred</SubmitChip>
    </form>
  );
}

function RemoveButton({
  patientId,
  identifierId,
  warnUnsetPreferred,
}: {
  patientId: string;
  identifierId: string;
  warnUnsetPreferred: boolean;
}) {
  const action = voidIdentifierAction.bind(null, patientId, identifierId);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const msg = warnUnsetPreferred
          ? "Remove the preferred identifier? No other will be promoted automatically."
          : "Remove this identifier?";
        if (!confirm(msg)) e.preventDefault();
      }}
    >
      <SubmitChip danger>Remove</SubmitChip>
    </form>
  );
}

function SubmitChip({
  children,
  danger = false,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  const base =
    "rounded-md border px-2 py-1 text-xs font-medium disabled:opacity-50";
  const tone = danger
    ? "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/40"
    : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900";
  return (
    <button type="submit" disabled={pending} className={`${base} ${tone}`}>
      {pending ? "…" : children}
    </button>
  );
}

function AddIdentifierForm({
  patientId,
  identifierTypes,
  canDefaultPreferred,
}: {
  patientId: string;
  identifierTypes: IdentifierType[];
  canDefaultPreferred: boolean;
}) {
  const bound = addIdentifierAction.bind(null, patientId);
  const [state, formAction] = useActionState(bound, ADD_INITIAL);

  if (identifierTypes.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        No identifier types configured for this tenant.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="rounded-md border border-dashed border-zinc-300 p-4 dark:border-zinc-700"
    >
      <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        Add identifier
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
        <div>
          <label htmlFor="typeId" className="block text-xs text-zinc-500">
            Type
          </label>
          <select
            id="typeId"
            name="typeId"
            defaultValue=""
            required
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
          >
            <option value="" disabled>
              — Select —
            </option>
            {identifierTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="value" className="block text-xs text-zinc-500">
            Value
          </label>
          <input
            id="value"
            name="value"
            type="text"
            required
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
          />
        </div>
        <div className="flex items-end">
          <SubmitChip>Add</SubmitChip>
        </div>
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
        <input
          type="checkbox"
          name="preferred"
          defaultChecked={canDefaultPreferred}
        />
        Mark as preferred
      </label>
      {state.error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
