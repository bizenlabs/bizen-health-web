"use client";

import { useFormStatus } from "react-dom";
import { voidAppointmentAction } from "../actions";

export function VoidAppointmentForm({
  appointmentId,
}: {
  appointmentId: string;
}) {
  const action = voidAppointmentAction.bind(null, appointmentId);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          !confirm(
            "Void this appointment? Use this only for records created in error — to call off a real appointment, use Cancel instead.",
          )
        ) {
          e.preventDefault();
        }
      }}
      className="mt-10 max-w-2xl rounded-md border border-red-200 p-4 dark:border-red-900/40"
    >
      <h2 className="text-sm font-semibold tracking-wide text-red-700 uppercase dark:text-red-300">
        Void appointment
      </h2>
      <p className="mt-1 text-xs text-zinc-500">
        Removes the record entirely. Cancelling keeps it visible with a
        cancelled status.
      </p>
      <label htmlFor="reason" className="mt-3 block text-xs text-zinc-500">
        Reason (optional)
      </label>
      <input
        id="reason"
        name="reason"
        type="text"
        placeholder="e.g. created in error"
        className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
      />
      <div className="mt-3 flex justify-end">
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
      className="rounded-md border border-red-300 bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
    >
      {pending ? "Voiding…" : "Void"}
    </button>
  );
}
