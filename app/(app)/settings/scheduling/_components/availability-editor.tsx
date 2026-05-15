"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ProviderAvailability } from "@/lib/appointments";
import { addAvailabilityAction, voidAvailabilityAction } from "../actions";
import { SCHEDULING_INITIAL } from "./scheduling-state";

const INPUT =
  "mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent";
const LABEL = "block text-xs text-zinc-500";

const DAYS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function AvailabilityEditor({
  providerId,
  availability,
}: {
  providerId: string;
  availability: ProviderAvailability[];
}) {
  const [state, formAction] = useActionState(
    addAvailabilityAction.bind(null, providerId),
    SCHEDULING_INITIAL,
  );

  const sorted = [...availability].sort(
    (a, b) =>
      DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek) ||
      a.startTime.localeCompare(b.startTime),
  );

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
        Weekly availability
      </h2>

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No availability rules yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {sorted.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
            >
              <div>
                <div className="font-medium">
                  {titleCase(rule.dayOfWeek)} · {rule.startTime.slice(0, 5)}–
                  {rule.endTime.slice(0, 5)}
                </div>
                <div className="text-xs text-zinc-500">
                  {rule.slotDurationMinutes}-min slots
                  {rule.location ? ` · ${rule.location}` : ""}
                  {rule.effectiveFrom || rule.effectiveTo
                    ? ` · ${rule.effectiveFrom ?? "…"} to ${rule.effectiveTo ?? "…"}`
                    : ""}
                </div>
              </div>
              <form action={voidAvailabilityAction.bind(null, rule.id)}>
                <button
                  type="submit"
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form
        action={formAction}
        className="mt-4 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
          Add a rule
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
          <div>
            <label htmlFor="dayOfWeek" className={LABEL}>
              Day
            </label>
            <select
              id="dayOfWeek"
              name="dayOfWeek"
              className={INPUT}
              defaultValue="MONDAY"
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {titleCase(d)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="startTime" className={LABEL}>
              Start
            </label>
            <input
              id="startTime"
              name="startTime"
              type="time"
              required
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="endTime" className={LABEL}>
              End
            </label>
            <input
              id="endTime"
              name="endTime"
              type="time"
              required
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="slotDurationMinutes" className={LABEL}>
              Slot length (min)
            </label>
            <input
              id="slotDurationMinutes"
              name="slotDurationMinutes"
              type="number"
              min={5}
              step={5}
              defaultValue={30}
              required
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="effectiveFrom" className={LABEL}>
              Effective from (optional)
            </label>
            <input
              id="effectiveFrom"
              name="effectiveFrom"
              type="date"
              className={INPUT}
            />
          </div>
          <div>
            <label htmlFor="effectiveTo" className={LABEL}>
              Effective to (optional)
            </label>
            <input
              id="effectiveTo"
              name="effectiveTo"
              type="date"
              className={INPUT}
            />
          </div>
          <div className="col-span-2 md:col-span-3">
            <label htmlFor="location" className={LABEL}>
              Location (optional)
            </label>
            <input
              id="location"
              name="location"
              type="text"
              placeholder="e.g. Room 1"
              className={INPUT}
            />
          </div>
        </div>
        {state.error ? (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
            {state.ok}
          </p>
        ) : null}
        <div className="mt-3 flex justify-end">
          <AddButton />
        </div>
      </form>
    </section>
  );
}

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Adding…" : "Add rule"}
    </button>
  );
}
