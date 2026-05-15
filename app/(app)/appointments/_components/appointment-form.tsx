"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import type {
  AppointmentDetail,
  AppointmentSlot,
  AppointmentType,
} from "@/lib/appointments";
import type { Provider } from "@/lib/providers";
import {
  clinicDateOf,
  clinicTimeOf,
  formatClinicTime,
  todayClinicISODate,
} from "@/lib/datetime";
import { loadOpenSlotsAction } from "../actions";
import {
  APPOINTMENT_FORM_INITIAL,
  type AppointmentFormState,
} from "./appointment-form-state";

type Mode =
  | { kind: "create"; patientId: string; patientName: string }
  | {
      kind: "edit";
      appointmentId: string;
      patientId: string;
      initial: AppointmentDetail;
    };

type FormAction = (
  prev: AppointmentFormState,
  formData: FormData,
) => Promise<AppointmentFormState>;

const INPUT =
  "mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent";
const LABEL = "block text-xs text-zinc-500";

export function AppointmentForm({
  mode,
  appointmentTypes,
  providers,
  action,
  cancelHref,
}: {
  mode: Mode;
  appointmentTypes: AppointmentType[];
  providers: Provider[];
  action: FormAction;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, APPOINTMENT_FORM_INITIAL);
  const initial = mode.kind === "edit" ? mode.initial : null;

  const [bookingMode, setBookingMode] = useState<"free" | "slot">("free");
  const [providerId, setProviderId] = useState(initial?.providerId ?? "");
  const [date, setDate] = useState(
    initial ? clinicDateOf(initial.startAt) : todayClinicISODate(),
  );
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const initialTime = initial ? clinicTimeOf(initial.startAt) : "";
  const initialDuration = initial
    ? Math.max(
        5,
        Math.round(
          (new Date(initial.endAt).getTime() -
            new Date(initial.startAt).getTime()) /
            60000,
        ),
      )
    : 30;

  // Load open slots for a provider + date. Invoked from the controls that
  // change those values (not an effect — avoids cascading-render churn).
  async function loadSlots(nextProviderId: string, nextDate: string) {
    if (!nextProviderId || !nextDate) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    try {
      setSlots(await loadOpenSlotsAction(nextProviderId, nextDate));
    } finally {
      setSlotsLoading(false);
    }
  }

  return (
    <form action={formAction} className="mt-6 max-w-2xl space-y-6">
      {mode.kind === "create" ? (
        <input type="hidden" name="patientId" value={mode.patientId} />
      ) : null}
      <input type="hidden" name="bookingMode" value={bookingMode} />

      <section>
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Appointment
        </h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {mode.kind === "create" ? (
            <div className="md:col-span-2">
              <span className={LABEL}>Patient</span>
              <p className="mt-1 text-sm font-medium">{mode.patientName}</p>
            </div>
          ) : null}

          <div>
            <label htmlFor="appointmentTypeId" className={LABEL}>
              Type
            </label>
            <select
              id="appointmentTypeId"
              name="appointmentTypeId"
              defaultValue={initial?.appointmentTypeId ?? ""}
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
              Provider {bookingMode === "free" ? "(optional)" : ""}
            </label>
            <select
              id="providerId"
              name="providerId"
              value={providerId}
              onChange={(e) => {
                setProviderId(e.target.value);
                if (bookingMode === "slot")
                  void loadSlots(e.target.value, date);
              }}
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

          <div>
            <label htmlFor="kind" className={LABEL}>
              Kind
            </label>
            <select
              id="kind"
              name="kind"
              defaultValue={initial?.kind ?? "SCHEDULED"}
              className={INPUT}
            >
              <option value="SCHEDULED">Scheduled</option>
              <option value="WALK_IN">Walk-in</option>
            </select>
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
            When
          </h2>
          <div className="ml-2 inline-flex rounded-md border border-zinc-200 p-0.5 text-xs dark:border-zinc-800">
            <ModeTab
              active={bookingMode === "free"}
              onClick={() => setBookingMode("free")}
            >
              Specific time
            </ModeTab>
            <ModeTab
              active={bookingMode === "slot"}
              onClick={() => {
                setBookingMode("slot");
                void loadSlots(providerId, date);
              }}
            >
              Open slot
            </ModeTab>
          </div>
        </div>

        {bookingMode === "free" ? (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label htmlFor="date" className={LABEL}>
                Date
              </label>
              <input
                id="date"
                name="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className={INPUT}
              />
              {state.fieldErrors.date ? (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {state.fieldErrors.date}
                </p>
              ) : null}
            </div>
            <div>
              <label htmlFor="time" className={LABEL}>
                Time
              </label>
              <input
                id="time"
                name="time"
                type="time"
                defaultValue={initialTime}
                required
                className={INPUT}
              />
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
                defaultValue={initialDuration}
                required
                className={INPUT}
              />
            </div>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="slotDate" className={LABEL}>
                Date
              </label>
              <input
                id="slotDate"
                type="date"
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  void loadSlots(providerId, e.target.value);
                }}
                className={INPUT}
              />
            </div>
            <div>
              <label htmlFor="slotId" className={LABEL}>
                Open slot
              </label>
              <select
                id="slotId"
                name="slotId"
                className={INPUT}
                disabled={!providerId}
              >
                <option value="">
                  {!providerId
                    ? "Choose a provider first"
                    : slotsLoading
                      ? "Loading…"
                      : slots.length === 0
                        ? "No open slots"
                        : "— Select a slot —"}
                </option>
                {slots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatClinicTime(s.startAt)} – {formatClinicTime(s.endAt)}
                  </option>
                ))}
              </select>
              {state.fieldErrors.slotId ? (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  {state.fieldErrors.slotId}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3">
        <div>
          <label htmlFor="reason" className={LABEL}>
            Reason (optional)
          </label>
          <input
            id="reason"
            name="reason"
            type="text"
            defaultValue={initial?.reason ?? ""}
            placeholder="e.g. follow-up for BP"
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="location" className={LABEL}>
            Location (optional)
          </label>
          <input
            id="location"
            name="location"
            type="text"
            defaultValue={initial?.location ?? ""}
            placeholder="e.g. Room 1"
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="notes" className={LABEL}>
            Notes (optional)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={4}
            defaultValue={initial?.notes ?? ""}
            className={INPUT}
          />
        </div>
      </section>

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
        <SubmitButton mode={mode.kind} />
      </div>
    </form>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded bg-zinc-900 px-2.5 py-1 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "rounded px-2.5 py-1 text-zinc-600 dark:text-zinc-400"
      }
    >
      {children}
    </button>
  );
}

function SubmitButton({ mode }: { mode: Mode["kind"] }) {
  const { pending } = useFormStatus();
  const label =
    mode === "edit"
      ? pending
        ? "Saving…"
        : "Save changes"
      : pending
        ? "Booking…"
        : "Book appointment";
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
    >
      {label}
    </button>
  );
}
