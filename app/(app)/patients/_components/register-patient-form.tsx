"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { IdentifierType } from "@/lib/patients";
import { registerPatientAction } from "../actions";

type RegisterPatientFormState = {
  error: string | null;
  fieldErrors: Record<string, string>;
};

const INITIAL_STATE: RegisterPatientFormState = {
  error: null,
  fieldErrors: {},
};

const GENDERS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "OTHER", label: "Other" },
  { value: "UNKNOWN", label: "Unknown" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Registering…" : "Register patient"}
    </button>
  );
}

export function RegisterPatientForm({
  identifierTypes,
}: {
  identifierTypes: IdentifierType[];
}) {
  const [state, formAction] = useActionState(
    registerPatientAction,
    INITIAL_STATE,
  );
  const [useEstimatedAge, setUseEstimatedAge] = useState(false);

  return (
    <form action={formAction} className="mt-6 max-w-2xl space-y-6">
      <section>
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Name
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          At least one of given or family name is required. Names are stored
          exactly as entered — no normalisation.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field
            label="Given name"
            name="givenName"
            error={state.fieldErrors.givenName}
          />
          <Field label="Middle name" name="middleName" />
          <Field
            label="Family name"
            name="familyName"
            error={state.fieldErrors.familyName}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Demographics
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="gender" className="block text-xs text-zinc-500">
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              defaultValue=""
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
            >
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <input
                type="checkbox"
                name="useEstimatedAge"
                checked={useEstimatedAge}
                onChange={(e) => setUseEstimatedAge(e.target.checked)}
              />
              Don&apos;t know exact DOB — enter age
            </label>
            {useEstimatedAge ? (
              <div className="mt-2">
                <label
                  htmlFor="estimatedAge"
                  className="block text-xs text-zinc-500"
                >
                  Approximate age (years)
                </label>
                <input
                  id="estimatedAge"
                  name="estimatedAge"
                  type="number"
                  min={0}
                  max={130}
                  className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
                />
              </div>
            ) : (
              <div className="mt-2">
                <label
                  htmlFor="birthdate"
                  className="block text-xs text-zinc-500"
                >
                  Date of birth
                </label>
                <input
                  id="birthdate"
                  name="birthdate"
                  type="date"
                  className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {identifierTypes.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
            Identifier (optional)
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Add a single identifier now; more can be added from the patient
            detail page later.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label
                htmlFor="identifierTypeId"
                className="block text-xs text-zinc-500"
              >
                Type
              </label>
              <select
                id="identifierTypeId"
                name="identifierTypeId"
                defaultValue=""
                className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
              >
                <option value="">— None —</option>
                {identifierTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <Field label="Value" name="identifierValue" />
          </div>
        </section>
      ) : null}

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <div className="flex justify-end">
        <SubmitButton />
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  error,
}: {
  label: string;
  name: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs text-zinc-500">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="text"
        className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
