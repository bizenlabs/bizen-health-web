"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { PatientDetail } from "@/lib/patients";
import {
  recordDeathAction,
  restorePatientAction,
  voidPatientAction,
} from "../actions";

type DeathState = { error: string | null };
const DEATH_INITIAL: DeathState = { error: null };

export function LifecycleActions({ patient }: { patient: PatientDetail }) {
  if (patient.voided) {
    return <RestoreBanner patient={patient} />;
  }
  return (
    <div className="space-y-6">
      {patient.demographics.dead ? null : <DeathRecordForm patient={patient} />}
      <VoidPatientPanel patient={patient} />
    </div>
  );
}

function RestoreBanner({ patient }: { patient: PatientDetail }) {
  const action = restorePatientAction.bind(null, patient.id);
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            This patient is voided
          </h2>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
            Voided patients are hidden from the patient list. Restore to make
            this record active again.
          </p>
        </div>
        <form action={action}>
          <SubmitChip>Restore</SubmitChip>
        </form>
      </div>
    </div>
  );
}

function DeathRecordForm({ patient }: { patient: PatientDetail }) {
  const [open, setOpen] = useState(false);
  const bound = recordDeathAction.bind(null, patient.id);
  const [state, formAction] = useActionState(bound, DEATH_INITIAL);

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-semibold tracking-wide text-zinc-500 uppercase hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        {open ? "− Record death" : "+ Record death"}
      </button>
      {open ? (
        <form
          action={formAction}
          className="mt-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label
                htmlFor="deathDate"
                className="block text-xs text-zinc-500"
              >
                Date of death
              </label>
              <input
                id="deathDate"
                name="deathDate"
                type="date"
                required
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
              />
            </div>
            <div>
              <label
                htmlFor="causeOfDeath"
                className="block text-xs text-zinc-500"
              >
                Cause (optional)
              </label>
              <input
                id="causeOfDeath"
                name="causeOfDeath"
                type="text"
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
              />
            </div>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
            <input type="checkbox" name="deathdateEstimated" />
            Date is estimated
          </label>
          <p className="mt-3 text-xs text-zinc-500">
            Recording death is idempotent — to correct a mistake, void the
            patient and re-register.
          </p>
          {state.error ? (
            <p className="mt-2 text-xs text-red-600 dark:text-red-400">
              {state.error}
            </p>
          ) : null}
          <div className="mt-3 flex justify-end">
            <SubmitChip>Record</SubmitChip>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function VoidPatientPanel({ patient }: { patient: PatientDetail }) {
  const [open, setOpen] = useState(false);
  const action = voidPatientAction.bind(null, patient.id);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-semibold tracking-wide text-red-700 uppercase hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
      >
        {open ? "− Void patient" : "+ Void patient"}
      </button>
      {open ? (
        <form
          action={action}
          onSubmit={(e) => {
            if (
              !confirm(
                "Void this patient? They will be hidden from lists. You can restore them later from a direct link.",
              )
            ) {
              e.preventDefault();
            }
          }}
          className="mt-3 rounded-md border border-red-200 p-4 dark:border-red-900/40"
        >
          <label htmlFor="reason" className="block text-xs text-zinc-500">
            Reason (optional)
          </label>
          <input
            id="reason"
            name="reason"
            type="text"
            placeholder="e.g. duplicate record"
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
          />
          <div className="mt-3 flex justify-end">
            <SubmitChip danger>Void patient</SubmitChip>
          </div>
        </form>
      ) : null}
    </section>
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
    "rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50";
  const tone = danger
    ? "border-red-300 bg-red-600 text-white hover:bg-red-700 dark:border-red-900/50"
    : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900";
  return (
    <button type="submit" disabled={pending} className={`${base} ${tone}`}>
      {pending ? "…" : children}
    </button>
  );
}
