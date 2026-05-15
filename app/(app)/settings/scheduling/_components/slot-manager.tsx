"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { AppointmentSlot } from "@/lib/appointments";
import {
  formatClinicDate,
  formatClinicTime,
  todayClinicISODate,
} from "@/lib/datetime";
import {
  blockSlotAction,
  generateSlotsAction,
  unblockSlotAction,
} from "../actions";
import { SCHEDULING_INITIAL } from "./scheduling-state";

const INPUT =
  "mt-1 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent";
const LABEL = "block text-xs text-zinc-500";

export function SlotManager({
  providerId,
  slots,
}: {
  providerId: string;
  slots: AppointmentSlot[];
}) {
  const [state, formAction] = useActionState(
    generateSlotsAction.bind(null, providerId),
    SCHEDULING_INITIAL,
  );

  const sorted = [...slots].sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
        Slots
      </h2>

      <form
        action={formAction}
        className="mt-3 flex flex-wrap items-end gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
      >
        <div>
          <label htmlFor="from" className={LABEL}>
            Generate from
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={todayClinicISODate()}
            required
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="to" className={LABEL}>
            to
          </label>
          <input id="to" name="to" type="date" required className={INPUT} />
        </div>
        <GenerateButton />
        {state.error ? (
          <p className="text-xs text-red-600 dark:text-red-400">
            {state.error}
          </p>
        ) : null}
        {state.ok ? (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">
            {state.ok}
          </p>
        ) : null}
      </form>

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          No slots in the next four weeks. Add availability, then generate.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {sorted.map((slot) => (
            <li
              key={slot.id}
              className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm"
            >
              <div>
                <span className="font-medium">
                  {formatClinicDate(slot.startAt)}
                </span>{" "}
                <span className="text-zinc-600 tabular-nums dark:text-zinc-400">
                  {formatClinicTime(slot.startAt)}–
                  {formatClinicTime(slot.endAt)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {slot.booked ? (
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                    Booked
                  </span>
                ) : slot.status === "BLOCKED" ? (
                  <>
                    <span className="text-xs text-zinc-500">Blocked</span>
                    <form action={unblockSlotAction.bind(null, slot.id)}>
                      <button
                        type="submit"
                        className="text-xs text-zinc-700 hover:underline dark:text-zinc-300"
                      >
                        Unblock
                      </button>
                    </form>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-emerald-600 dark:text-emerald-400">
                      Open
                    </span>
                    <form action={blockSlotAction.bind(null, slot.id)}>
                      <button
                        type="submit"
                        className="text-xs text-zinc-700 hover:underline dark:text-zinc-300"
                      >
                        Block
                      </button>
                    </form>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {pending ? "Generating…" : "Generate slots"}
    </button>
  );
}
