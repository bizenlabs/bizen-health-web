"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import { CheckboxField, Checkbox } from "@/components/catalyst/checkbox";
import {
  Description,
  ErrorMessage,
  Field,
  Label,
} from "@/components/catalyst/fieldset";
import { Input } from "@/components/catalyst/input";
import { Select } from "@/components/catalyst/select";
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
    <form action={formAction} className="mt-8 max-w-3xl">
      {state.error ? (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
        >
          <ExclamationTriangleIcon
            className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400"
            aria-hidden="true"
          />
          <p>{state.error}</p>
        </div>
      ) : null}

      <div className="space-y-12">
        <FormSection
          title="Basic info"
          description="At least one of given or family name."
        >
          <div className="sm:col-span-2">
            <Field>
              <Label>Given name</Label>
              <Input
                name="givenName"
                defaultValue={patient.name.givenName ?? ""}
                autoComplete="off"
                invalid={!!state.fieldErrors.givenName}
              />
              {state.fieldErrors.givenName ? (
                <ErrorMessage>{state.fieldErrors.givenName}</ErrorMessage>
              ) : null}
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field>
              <Label>Middle name</Label>
              <Input
                name="middleName"
                defaultValue={patient.name.middleName ?? ""}
                autoComplete="off"
              />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field>
              <Label>Family name</Label>
              <Input
                name="familyName"
                defaultValue={patient.name.familyName ?? ""}
                autoComplete="off"
                invalid={!!state.fieldErrors.familyName}
              />
              {state.fieldErrors.familyName ? (
                <ErrorMessage>{state.fieldErrors.familyName}</ErrorMessage>
              ) : null}
            </Field>
          </div>

          <div className="sm:col-span-3">
            <Field>
              <Label>Gender</Label>
              <Select
                name="gender"
                defaultValue={patient.demographics.gender ?? ""}
              >
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="sm:col-span-3">
            <CheckboxField>
              <Checkbox
                name="useEstimatedAge"
                checked={useEstimatedAge}
                onChange={setUseEstimatedAge}
              />
              <Label>Don&apos;t know exact DOB — enter age</Label>
              <Description>
                Use when only the approximate age is known. Stored as estimated
                and can be refined later.
              </Description>
            </CheckboxField>

            {useEstimatedAge ? (
              <Field className="mt-4">
                <Label>Approximate age (years)</Label>
                <Input
                  name="estimatedAge"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={130}
                  defaultValue={initialAgeYears ?? ""}
                />
              </Field>
            ) : (
              <Field className="mt-4">
                <Label>Date of birth</Label>
                <Input
                  name="birthdate"
                  type="date"
                  defaultValue={
                    patient.demographics.birthdate &&
                    !patient.demographics.birthdateEstimated
                      ? patient.demographics.birthdate
                      : ""
                  }
                />
              </Field>
            )}
          </div>
        </FormSection>

        <AddressSection address={patient.address} last />
      </div>

      <div className="mt-6 flex items-center justify-end gap-x-6">
        <Button href={`/patients/${patient.id}`} plain>
          Cancel
        </Button>
        <SaveButton />
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save changes"}
    </Button>
  );
}

function FormSection({
  title,
  description,
  tone,
  last = false,
  children,
}: {
  title: string;
  description?: string;
  tone?: "required" | "optional";
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={
        last
          ? undefined
          : "border-b border-zinc-950/10 pb-12 dark:border-white/10"
      }
    >
      <div className="flex items-center gap-2">
        <h2 className="text-base/7 font-semibold text-zinc-950 dark:text-white">
          {title}
        </h2>
        {tone === "required" ? <Badge color="amber">Required</Badge> : null}
        {tone === "optional" ? <Badge color="zinc">Optional</Badge> : null}
      </div>
      {description ? (
        <p className="mt-1 text-sm/6 text-zinc-600 dark:text-zinc-400">
          {description}
        </p>
      ) : null}
      <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
        {children}
      </div>
    </div>
  );
}

function AddressSection({
  address,
  last = false,
}: {
  address: PatientDetail["address"];
  last?: boolean;
}) {
  const hasAny = Object.values(address).some(Boolean);
  const [open, setOpen] = useState(hasAny);

  return (
    <div
      className={
        last
          ? undefined
          : "border-b border-zinc-950/10 pb-12 dark:border-white/10"
      }
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <h2 className="text-base/7 font-semibold text-zinc-950 dark:text-white">
            Address
          </h2>
          <Badge color="zinc">Optional</Badge>
        </span>
        <span className="flex items-center gap-2 text-xs text-zinc-500 group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
          {!open && !hasAny ? "Not provided" : null}
          <ChevronDownIcon
            className={
              open
                ? "size-4 rotate-180 transition-transform"
                : "size-4 transition-transform"
            }
          />
        </span>
      </button>

      {open ? (
        <div className="mt-8 grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-6">
          {ADDRESS_FIELDS.map((f) => (
            <div key={f.name} className={f.colSpan}>
              <Field>
                <Label>{f.label}</Label>
                <Input
                  name={f.name}
                  autoComplete={f.autoComplete}
                  defaultValue={address[f.name] ?? ""}
                />
              </Field>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type AddressKey =
  | "address1"
  | "address2"
  | "cityVillage"
  | "countyDistrict"
  | "stateProvince"
  | "country"
  | "postalCode";

const ADDRESS_FIELDS: {
  name: AddressKey;
  label: string;
  autoComplete: string;
  colSpan: string;
}[] = [
  {
    name: "address1",
    label: "Line 1",
    autoComplete: "address-line1",
    colSpan: "sm:col-span-6",
  },
  {
    name: "address2",
    label: "Line 2",
    autoComplete: "address-line2",
    colSpan: "sm:col-span-6",
  },
  {
    name: "cityVillage",
    label: "City / village",
    autoComplete: "address-level2",
    colSpan: "sm:col-span-3",
  },
  {
    name: "countyDistrict",
    label: "District",
    autoComplete: "address-level3",
    colSpan: "sm:col-span-3",
  },
  {
    name: "stateProvince",
    label: "State / province",
    autoComplete: "address-level1",
    colSpan: "sm:col-span-2",
  },
  {
    name: "country",
    label: "Country",
    autoComplete: "country-name",
    colSpan: "sm:col-span-2",
  },
  {
    name: "postalCode",
    label: "Postal code",
    autoComplete: "postal-code",
    colSpan: "sm:col-span-2",
  },
];
