"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type { AppointmentType } from "@/lib/appointments";
import type { Provider } from "@/lib/providers";
import { todayClinicISODate } from "@/lib/datetime";
import { createRecurrenceAction } from "../actions";
import { APPOINTMENT_FORM_INITIAL } from "./appointment-form-state";

const INPUT =
  "mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent";
const LABEL = "block text-xs text-zinc-500";

const WEEKDAYS: { value: string; label: string }[] = [
  { value: "MONDAY", label: "Mon" },
  { value: "TUESDAY", label: "Tue" },
  { value: "WEDNESDAY", label: "Wed" },
  { value: "THURSDAY", label: "Thu" },
  { value: "FRIDAY", label: "Fri" },
  { value: "SATURDAY", label: "Sat" },
  { value: "SUNDAY", label: "Sun" },
];

export function RecurrenceForm({
  patientId,
  patientName,
  appointmentTypes,
  providers,
  cancelHref,
}: {
  patientId: string;
  patientName: string;
  appointmentTypes: AppointmentType[];
  providers: Provider[];
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(
    createRecurrenceAction,
    APPOINTMENT_FORM_INITIAL,
  );
  const [frequency, setFrequency] = useState("WEEKLY");
  const [endMode, setEndMode] = useState<"date" | "count">("count");

  return (
    <form action={formAction} className="mt-6 max-w-2xl space-y-6">
      <input type="hidden" name="patientId" value={patientId} />

      <section>
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Recurring series
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <span className={LABEL}>Patient</span>
            <p className="mt-1 text-sm font-medium">{patientName}</p>
          </div>

          <div>
            <label htmlFor="appointmentTypeId" className={LABEL}>
              Type
            </label>
            <select
              id="appointmentTypeId"
              name="appointmentTypeId"
              defaultValue=""
              required
              className={INPUT}
            >
              <option value="" disabled>
                — Select —
              </option>
              {appointmentTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {state.fieldErrors.appointmentTypeId ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {state.fieldErrors.appointmentTypeId}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="providerId" className={LABEL}>
              Provider (optional)
            </label>
            <select
              id="providerId"
              name="providerId"
              defaultValue=""
              className={INPUT}
            >
              <option value="">— Unassigned —</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName ?? p.email}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Repeats
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="frequency" className={LABEL}>
              Frequency
            </label>
            <select
              id="frequency"
              name="frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className={INPUT}
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
          <div>
            <label htmlFor="recurInterval" className={LABEL}>
              Every (interval)
            </label>
            <input
              id="recurInterval"
              name="recurInterval"
              type="number"
              min={1}
              defaultValue={1}
              className={INPUT}
            />
          </div>

          {frequency === "WEEKLY" ? (
            <div className="md:col-span-2">
              <span className={LABEL}>Days of week</span>
              <div className="mt-1 flex flex-wrap gap-3">
                {WEEKDAYS.map((d) => (
                  <label
                    key={d.value}
                    className="flex items-center gap-1.5 text-sm"
                  >
                    <input type="checkbox" name="daysOfWeek" value={d.value} />
                    {d.label}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                Leave all unchecked to repeat on the start date&apos;s weekday.
              </p>
            </div>
          ) : null}

          <div>
            <label htmlFor="startDate" className={LABEL}>
              Start date
            </label>
            <input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={todayClinicISODate()}
              required
              className={INPUT}
            />
            {state.fieldErrors.startDate ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {state.fieldErrors.startDate}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="startTime" className={LABEL}>
              Time
            </label>
            <input
              id="startTime"
              name="startTime"
              type="time"
              required
              className={INPUT}
            />
            {state.fieldErrors.startTime ? (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                {state.fieldErrors.startTime}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="durationMinutes" className={LABEL}>
              Duration (min)
            </label>
            <input
              id="durationMinutes"
              name="durationMinutes"
              type="number"
              min={5}
              step={5}
              defaultValue={30}
              required
              className={INPUT}
            />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Ends
        </h2>
        <input type="hidden" name="endMode" value={endMode} />
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="endModeRadio"
              checked={endMode === "count"}
              onChange={() => setEndMode("count")}
            />
            After
            <input
              name="occurrenceCount"
              type="number"
              min={1}
              defaultValue={8}
              disabled={endMode !== "count"}
              className="w-20 rounded-md border border-zinc-200 px-2 py-1 text-sm disabled:opacity-50 dark:border-zinc-800 dark:bg-transparent"
            />
            occurrences
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="endModeRadio"
              checked={endMode === "date"}
              onChange={() => setEndMode("date")}
            />
            On date
            <input
              name="endDate"
              type="date"
              disabled={endMode !== "date"}
              className="rounded-md border border-zinc-200 px-2 py-1 text-sm disabled:opacity-50 dark:border-zinc-800 dark:bg-transparent"
            />
          </label>
        </div>
        {state.fieldErrors.endMode ? (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {state.fieldErrors.endMode}
          </p>
        ) : null}
      </section>

      <div>
        <label htmlFor="location" className={LABEL}>
          Location (optional)
        </label>
        <input id="location" name="location" type="text" className={INPUT} />
      </div>

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
        <SubmitButton />
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Creating…" : "Create series"}
    </button>
  );
}
