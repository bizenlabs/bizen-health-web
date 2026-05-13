"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { PatientDetail } from "@/lib/patients";
import { updatePatientAction } from "../actions";

type State = { error: string | null; fieldErrors: Record<string, string> };
const INITIAL_STATE: State = { error: null, fieldErrors: {} };

const GENDERS = [
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
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export function EditPatientForm({ patient }: { patient: PatientDetail }) {
  const action = updatePatientAction.bind(null, patient.id);
  const [state, formAction] = useActionState(action, INITIAL_STATE);

  const initiallyEstimated =
    !!patient.demographics.birthdate && patient.demographics.birthdateEstimated;
  const [useEstimatedAge, setUseEstimatedAge] = useState(initiallyEstimated);

  const initialAgeYears = initiallyEstimated
    ? new Date().getFullYear() -
      Number(patient.demographics.birthdate!.slice(0, 4))
    : null;

  return (
    <form action={formAction} className="mt-6 max-w-2xl space-y-6">
      <section>
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Name
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Field
            label="Given name"
            name="givenName"
            defaultValue={patient.name.givenName ?? ""}
            error={state.fieldErrors.givenName}
          />
          <Field
            label="Middle name"
            name="middleName"
            defaultValue={patient.name.middleName ?? ""}
          />
          <Field
            label="Family name"
            name="familyName"
            defaultValue={patient.name.familyName ?? ""}
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
              defaultValue={patient.demographics.gender ?? ""}
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
                  defaultValue={initialAgeYears ?? ""}
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
                  defaultValue={
                    patient.demographics.birthdate &&
                    !patient.demographics.birthdateEstimated
                      ? patient.demographics.birthdate
                      : ""
                  }
                  className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <AddressSection address={patient.address} />

      {state.error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      ) : null}

      <div className="flex justify-end gap-3">
        <Link
          href={`/patients/${patient.id}`}
          className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Cancel
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  error,
}: {
  label: string;
  name: string;
  defaultValue?: string;
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
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}

function AddressSection({ address }: { address: PatientDetail["address"] }) {
  const hasAny = Object.values(address).some((v) => v);
  const [open, setOpen] = useState(hasAny);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-semibold tracking-wide text-zinc-500 uppercase hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        {open ? "− Address" : "+ Address (optional)"}
      </button>
      {open ? (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field
            label="Line 1"
            name="address1"
            defaultValue={address.address1 ?? ""}
          />
          <Field
            label="Line 2"
            name="address2"
            defaultValue={address.address2 ?? ""}
          />
          <Field
            label="City / village"
            name="cityVillage"
            defaultValue={address.cityVillage ?? ""}
          />
          <Field
            label="District"
            name="countyDistrict"
            defaultValue={address.countyDistrict ?? ""}
          />
          <Field
            label="State / province"
            name="stateProvince"
            defaultValue={address.stateProvince ?? ""}
          />
          <Field
            label="Country"
            name="country"
            defaultValue={address.country ?? ""}
          />
          <Field
            label="Postal code"
            name="postalCode"
            defaultValue={address.postalCode ?? ""}
          />
        </div>
      ) : null}
    </section>
  );
}
