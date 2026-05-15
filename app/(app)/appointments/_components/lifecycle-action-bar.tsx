"use client";

import { useFormStatus } from "react-dom";
import type { AppointmentStatus } from "@/lib/appointments";
import {
  cancelAppointmentAction,
  checkInAppointmentAction,
  completeAppointmentAction,
  noShowAppointmentAction,
} from "../actions";

type Tone = "primary" | "danger";

/** Status-gated lifecycle buttons. Hidden once the appointment is terminal. */
export function LifecycleActionBar({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: AppointmentStatus;
}) {
  if (
    status === "COMPLETED" ||
    status === "CANCELLED" ||
    status === "NO_SHOW"
  ) {
    return null;
  }

  const checkIn = checkInAppointmentAction.bind(null, appointmentId);
  const complete = completeAppointmentAction.bind(null, appointmentId);
  const cancel = cancelAppointmentAction.bind(null, appointmentId);
  const noShow = noShowAppointmentAction.bind(null, appointmentId);

  return (
    <div className="mt-6 flex flex-wrap gap-2">
      {status === "SCHEDULED" ? (
        <ActionButton
          action={checkIn}
          label="Check in"
          busy="Checking in…"
          tone="primary"
        />
      ) : null}
      <ActionButton
        action={complete}
        label="Complete"
        busy="Completing…"
        tone="primary"
        confirmMsg="Mark this appointment completed?"
      />
      <ActionButton
        action={cancel}
        label="Cancel"
        busy="Cancelling…"
        tone="danger"
        confirmMsg="Cancel this appointment?"
      />
      {status === "SCHEDULED" ? (
        <ActionButton
          action={noShow}
          label="No-show"
          busy="Saving…"
          tone="danger"
          confirmMsg="Mark this patient as a no-show?"
        />
      ) : null}
    </div>
  );
}

function ActionButton({
  action,
  label,
  busy,
  tone,
  confirmMsg,
}: {
  action: (formData: FormData) => void | Promise<void>;
  label: string;
  busy: string;
  tone: Tone;
  confirmMsg?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirmMsg && !confirm(confirmMsg)) e.preventDefault();
      }}
    >
      <SubmitButton label={label} busy={busy} tone={tone} />
    </form>
  );
}

function SubmitButton({
  label,
  busy,
  tone,
}: {
  label: string;
  busy: string;
  tone: Tone;
}) {
  const { pending } = useFormStatus();
  const cls =
    tone === "danger"
      ? "rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/30"
      : "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";
  return (
    <button type="submit" disabled={pending} className={cls}>
      {pending ? busy : label}
    </button>
  );
}
