"use client";

import { useActionState, useMemo, useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/16/solid";
import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { Badge } from "@/components/catalyst/badge";
import { Button } from "@/components/catalyst/button";
import {
  Description,
  ErrorMessage,
  Field,
  Fieldset,
  Label,
  Legend,
} from "@/components/catalyst/fieldset";
import { Input } from "@/components/catalyst/input";
import { Select } from "@/components/catalyst/select";
import { Text } from "@/components/catalyst/text";
import type { IdentifierType } from "@/lib/patients";
import { registerPatientAction } from "../actions";
import { DatePicker } from "./date-picker";
import { PhotoInput } from "./photo-input";

type FormState = {
  error: string | null;
  fieldErrors: Record<string, string>;
};

const INITIAL_STATE: FormState = { error: null, fieldErrors: {} };

const GENDERS: { value: string; label: string }[] = [
  { value: "", label: "—" },
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "OTHER", label: "Other" },
  { value: "UNKNOWN", label: "Unknown" },
];

type AgeMode = "dob" | "estimated" | "unknown";

const AGE_MODES: { value: AgeMode; label: string }[] = [
  { value: "dob", label: "Exact DOB" },
  { value: "estimated", label: "Approximate" },
  { value: "unknown", label: "Unknown" },
];

export function RegisterPatientForm({
  identifierTypes,
}: {
  identifierTypes: IdentifierType[];
}) {
  const [state, formAction, isPending] = useActionState(
    registerPatientAction,
    INITIAL_STATE,
  );
  const [ageMode, setAgeMode] = useState<AgeMode>("dob");
  const [birthdate, setBirthdate] = useState("");
  const [estimatedAge, setEstimatedAge] = useState("");

  // Live feedback so receptionists catch typos before submit.
  const ageFromDob = useMemo(() => describeAge(birthdate), [birthdate]);
  const yearFromEstimate = useMemo(() => {
    const n = Number(estimatedAge);
    if (!Number.isFinite(n) || n < 0 || n > 130) return null;
    return new Date().getFullYear() - Math.floor(n);
  }, [estimatedAge]);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="mt-8 max-w-3xl"
    >
      {state.error ? (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200"
        >
          <ExclamationTriangleIcon
            className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Couldn’t register patient</p>
            <p className="mt-0.5 text-red-800/90 dark:text-red-200/90">
              {state.error}
            </p>
          </div>
        </div>
      ) : null}

      <div className="space-y-12">
        {/* — Basic info — */}
        <FormSection
          title="Basic info"
          description="At least one of given or family name. Stored exactly as entered — no normalisation."
          tone="required"
        >
          <div className="sm:col-span-2">
            <Field>
              <Label>Given name</Label>
              <Input
                name="givenName"
                autoFocus
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
              <Input name="middleName" autoComplete="off" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field>
              <Label>Family name</Label>
              <Input
                name="familyName"
                autoComplete="off"
                invalid={!!state.fieldErrors.familyName}
              />
              {state.fieldErrors.familyName ? (
                <ErrorMessage>{state.fieldErrors.familyName}</ErrorMessage>
              ) : null}
            </Field>
          </div>

          <div className="sm:col-span-6">
            <PhotoInput />
          </div>

          <div className="sm:col-span-3">
            <Fieldset>
              <Legend className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                Age
              </Legend>
              <SegmentedToggle
                value={ageMode}
                onChange={setAgeMode}
                options={AGE_MODES}
              />

              {ageMode === "dob" ? (
                <Field className="mt-4">
                  <Label className="sr-only">Date of birth</Label>
                  <DatePicker
                    name="birthdate"
                    value={birthdate}
                    onChange={setBirthdate}
                    max={new Date().toISOString().slice(0, 10)}
                    placeholder="Select date of birth"
                  />
                  {ageFromDob !== null ? (
                    <Description>
                      {ageFromDob === "newborn"
                        ? "Newborn"
                        : `≈ ${ageFromDob} old`}
                    </Description>
                  ) : null}
                </Field>
              ) : null}

              {ageMode === "estimated" ? (
                <Field className="mt-4">
                  <Label className="sr-only">Approximate age</Label>
                  <input type="hidden" name="useEstimatedAge" value="on" />
                  <Input
                    type="number"
                    name="estimatedAge"
                    inputMode="numeric"
                    min={0}
                    max={130}
                    placeholder="years"
                    value={estimatedAge}
                    onChange={(e) => setEstimatedAge(e.target.value)}
                    invalid={!!state.fieldErrors.estimatedAge}
                  />
                  {state.fieldErrors.estimatedAge ? (
                    <ErrorMessage>
                      {state.fieldErrors.estimatedAge}
                    </ErrorMessage>
                  ) : yearFromEstimate !== null ? (
                    <Description>
                      Recorded as born around January {yearFromEstimate}.
                    </Description>
                  ) : (
                    <Description>
                      Stored as estimated; can be refined later.
                    </Description>
                  )}
                </Field>
              ) : null}

              {ageMode === "unknown" ? (
                <Text className="mt-4">
                  No age recorded. Add later when known.
                </Text>
              ) : null}
            </Fieldset>
          </div>

          <div className="sm:col-span-3">
            <Field>
              <Label>Gender</Label>
              <Select name="gender" defaultValue="">
                {GENDERS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {identifierTypes.length > 0 ? (
            <>
              <div className="sm:col-span-3">
                <Field>
                  <Label>Identifier type</Label>
                  <Description>Optional.</Description>
                  <Select name="identifierTypeId" defaultValue="">
                    <option value="">— None —</option>
                    {identifierTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="sm:col-span-3">
                <Field>
                  <Label>Identifier value</Label>
                  <Description>Required if a type is chosen.</Description>
                  <Input name="identifierValue" autoComplete="off" />
                </Field>
              </div>
            </>
          ) : null}
        </FormSection>

        {/* — Address — */}
        <AddressSection last />
      </div>

      <div className="mt-6 flex items-center justify-end gap-x-6">
        <Button href="/patients" plain>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Registering…" : "Register patient"}
        </Button>
      </div>
    </form>
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

function SegmentedToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
}) {
  return (
    <div
      role="radiogroup"
      className="mt-3 inline-flex rounded-full border border-zinc-950/10 bg-zinc-50 p-1 text-sm dark:border-white/10 dark:bg-zinc-800/40"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={
              active
                ? "rounded-full bg-zinc-600 px-4 py-1.5 font-semibold text-white shadow-sm ring-1 ring-zinc-700/20 transition-colors dark:bg-zinc-300 dark:text-zinc-900 dark:ring-white/10"
                : "rounded-full px-4 py-1.5 text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function AddressSection({
  defaultValues,
  last = false,
}: {
  defaultValues?: Partial<Record<AddressKey, string | null>>;
  last?: boolean;
}) {
  const hasAny = defaultValues
    ? Object.values(defaultValues).some(Boolean)
    : false;
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
                  defaultValue={defaultValues?.[f.name] ?? ""}
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

function describeAge(isoDate: string): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();

  let years = now.getFullYear() - d.getFullYear();
  let months = now.getMonth() - d.getMonth();
  let days = now.getDate() - d.getDate();
  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  if (months < 0) {
    years--;
    months += 12;
  }
  if (years < 0 || years > 130) return null;

  if (years >= 1) return `${years} ${years === 1 ? "year" : "years"}`;
  if (months >= 1) return `${months} ${months === 1 ? "month" : "months"}`;
  if (days >= 1) return `${days} ${days === 1 ? "day" : "days"}`;
  return "newborn";
}
