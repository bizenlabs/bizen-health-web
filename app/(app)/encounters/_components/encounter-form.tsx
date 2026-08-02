"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { EncounterDetail, EncounterType } from "@/lib/encounters";
import { DictatableNotesField } from "./dictatable-notes-field";
import {
  ENCOUNTER_FORM_INITIAL,
  type EncounterFormState,
} from "./encounter-form-state";

type Mode =
  | { kind: "create"; patientId: string }
  | {
      kind: "edit";
      encounterId: string;
      patientId: string;
      initial: EncounterDetail;
    };

type FormAction = (
  prev: EncounterFormState,
  formData: FormData,
) => Promise<EncounterFormState>;

export function EncounterForm({
  mode,
  encounterTypes,
  action,
  cancelHref,
}: {
  mode: Mode;
  encounterTypes: EncounterType[];
  action: FormAction;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, ENCOUNTER_FORM_INITIAL);

  const initial = mode.kind === "edit" ? mode.initial : null;
  const initialDate = initial?.encounterDatetime
    ? initial.encounterDatetime.slice(0, 10)
    : todayISODate();
  const initialTime = initial?.encounterDatetime
    ? initial.encounterDatetime.slice(11, 16)
    : "";

  return (
    <form action={formAction} className="mt-6 max-w-2xl space-y-6">
      <section>
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Encounter
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label
              htmlFor="encounterTypeId"
              className="block text-xs text-zinc-500"
            >
              Type
            </label>
            <select
              id="encounterTypeId"
              name="encounterTypeId"
              defaultValue={initial?.encounterTypeId ?? ""}
              required
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
            >
              <option value="" disabled>
                — Select —
              </option>
              {encounterTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {state.fieldErrors.encounterTypeId ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {state.fieldErrors.encounterTypeId}
              </p>
            ) : null}
          </div>

          <div>
            <label className="block text-xs text-zinc-500">Date / time</label>
            <div className="mt-1 flex gap-2">
              <input
                id="encounterDate"
                name="encounterDate"
                type="date"
                defaultValue={initialDate}
                required
                className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
              />
              <input
                id="encounterTime"
                name="encounterTime"
                type="time"
                defaultValue={initialTime}
                className="w-32 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
              />
            </div>
            {state.fieldErrors.encounterDate ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {state.fieldErrors.encounterDate}
              </p>
            ) : null}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="location" className="block text-xs text-zinc-500">
              Location (optional)
            </label>
            <input
              id="location"
              name="location"
              type="text"
              defaultValue={initial?.location ?? ""}
              placeholder="e.g. Room 1, Field visit, Phone"
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
            />
          </div>

          <div className="md:col-span-2">
            <DictatableNotesField
              encounterId={mode.kind === "edit" ? mode.encounterId : null}
              defaultValue={initial?.notes ?? ""}
            />
          </div>
        </div>
      </section>

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <div className="flex justify-end gap-3">
        <Link
          href={cancelHref}
          className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Cancel
        </Link>
        <SubmitButton mode={mode.kind} />
      </div>
    </form>
  );
}

function SubmitButton({ mode }: { mode: Mode["kind"] }) {
  const { pending } = useFormStatus();
  const label =
    mode === "edit"
      ? pending
        ? "Saving…"
        : "Save changes"
      : pending
        ? "Recording…"
        : "Record encounter";
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {label}
    </button>
  );
}

function todayISODate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
