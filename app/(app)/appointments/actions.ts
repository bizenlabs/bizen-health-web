"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  bookAppointment,
  cancelAppointment,
  cancelRecurrence,
  checkInAppointment,
  completeAppointment,
  createRecurrence,
  listSlots,
  noShowAppointment,
  rescheduleAppointment,
  restoreAppointment,
  voidAppointment,
  type AppointmentKind,
  type AppointmentSlot,
  type RecurrenceFrequency,
} from "@/lib/appointments";
import { clinicLocalToInstant } from "@/lib/datetime";
import type { AppointmentFormState } from "./_components/appointment-form-state";

function str(formData: FormData, key: string): string {
  return (formData.get(key) ?? "").toString().trim();
}

/** Build a start/end instant pair from clinic-local date + time + duration. */
function freeTimeRange(
  date: string,
  time: string,
  durationMinutes: number,
): { startAt: string; endAt: string } | null {
  if (!date || !time) return null;
  const startAt = clinicLocalToInstant(date, time);
  const dur =
    Number.isFinite(durationMinutes) && durationMinutes > 0
      ? durationMinutes
      : 30;
  const endAt = new Date(
    new Date(startAt).getTime() + dur * 60_000,
  ).toISOString();
  return { startAt, endAt };
}

/** Reactive slot loader for the booking form (open, unbooked slots only). */
export async function loadOpenSlotsAction(
  providerId: string,
  date: string,
): Promise<AppointmentSlot[]> {
  await requireSession();
  if (!providerId || !date) return [];
  try {
    const slots = await listSlots(providerId, date, date);
    return slots.filter((s) => s.status === "OPEN" && !s.booked);
  } catch {
    return [];
  }
}

export async function bookAppointmentAction(
  _prev: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  await requireSession();

  const patientId = str(formData, "patientId");
  const appointmentTypeId = str(formData, "appointmentTypeId");
  const providerId = str(formData, "providerId") || null;
  const bookingMode = str(formData, "bookingMode");
  const slotId = str(formData, "slotId") || null;
  const reason = str(formData, "reason") || null;
  const notes = str(formData, "notes") || null;
  const location = str(formData, "location") || null;
  const kind = (str(formData, "kind") || "SCHEDULED") as AppointmentKind;

  if (!patientId) return { error: "A patient is required.", fieldErrors: {} };
  if (!appointmentTypeId) {
    return {
      error: "Appointment type is required.",
      fieldErrors: { appointmentTypeId: "Required" },
    };
  }

  let body;
  if (bookingMode === "slot") {
    if (!slotId) {
      return {
        error: "Pick an open slot, or switch to a specific time.",
        fieldErrors: { slotId: "Required" },
      };
    }
    body = {
      patientId,
      appointmentTypeId,
      slotId,
      reason,
      notes,
      location,
      kind,
    };
  } else {
    const range = freeTimeRange(
      str(formData, "date"),
      str(formData, "time"),
      Number(str(formData, "durationMinutes")),
    );
    if (!range) {
      return {
        error: "Date and time are required.",
        fieldErrors: { date: "Required" },
      };
    }
    body = {
      patientId,
      providerId,
      appointmentTypeId,
      startAt: range.startAt,
      endAt: range.endAt,
      kind,
      reason,
      notes,
      location,
    };
  }

  let createdId: string;
  try {
    const created = await bookAppointment(body);
    createdId = created.id;
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        error: err.message || "Failed to book appointment",
        fieldErrors: Object.fromEntries(
          err.fields.map((f) => [f.path, f.message]),
        ),
      };
    }
    return { error: "Failed to book appointment", fieldErrors: {} };
  }

  revalidatePath("/appointments");
  revalidatePath(`/patients/${patientId}`);
  redirect(`/appointments/${createdId}`);
}

export async function rescheduleAppointmentAction(
  appointmentId: string,
  patientId: string,
  _prev: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  await requireSession();

  const appointmentTypeId = str(formData, "appointmentTypeId");
  const providerId = str(formData, "providerId") || null;
  const bookingMode = str(formData, "bookingMode");
  const slotId = str(formData, "slotId") || null;
  const reason = str(formData, "reason") || null;
  const notes = str(formData, "notes") || null;
  const location = str(formData, "location") || null;

  if (!appointmentTypeId) {
    return {
      error: "Appointment type is required.",
      fieldErrors: { appointmentTypeId: "Required" },
    };
  }

  let body;
  if (bookingMode === "slot") {
    if (!slotId) {
      return {
        error: "Pick an open slot.",
        fieldErrors: { slotId: "Required" },
      };
    }
    body = { appointmentTypeId, slotId, reason, notes, location };
  } else {
    const range = freeTimeRange(
      str(formData, "date"),
      str(formData, "time"),
      Number(str(formData, "durationMinutes")),
    );
    if (!range) {
      return {
        error: "Date and time are required.",
        fieldErrors: { date: "Required" },
      };
    }
    body = {
      providerId,
      appointmentTypeId,
      startAt: range.startAt,
      endAt: range.endAt,
      reason,
      notes,
      location,
    };
  }

  try {
    await rescheduleAppointment(appointmentId, body);
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        error: err.message || "Failed to reschedule appointment",
        fieldErrors: Object.fromEntries(
          err.fields.map((f) => [f.path, f.message]),
        ),
      };
    }
    return { error: "Failed to reschedule appointment", fieldErrors: {} };
  }

  revalidatePath("/appointments");
  revalidatePath(`/appointments/${appointmentId}`);
  revalidatePath(`/patients/${patientId}`);
  redirect(`/appointments/${appointmentId}`);
}

// --- lifecycle (return void, throw on error — mirrors voidEncounterAction) ---

export async function checkInAppointmentAction(
  appointmentId: string,
): Promise<void> {
  await requireSession();
  try {
    await checkInAppointment(appointmentId);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to check in");
  }
  revalidatePath("/appointments");
  revalidatePath(`/appointments/${appointmentId}`);
}

export async function completeAppointmentAction(
  appointmentId: string,
  formData: FormData,
): Promise<void> {
  await requireSession();
  const fulfillingEncounterId = str(formData, "fulfillingEncounterId") || null;
  try {
    await completeAppointment(appointmentId, { fulfillingEncounterId });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to complete appointment");
  }
  revalidatePath("/appointments");
  revalidatePath(`/appointments/${appointmentId}`);
}

export async function cancelAppointmentAction(
  appointmentId: string,
  formData: FormData,
): Promise<void> {
  await requireSession();
  const reason = str(formData, "reason") || undefined;
  try {
    await cancelAppointment(appointmentId, reason);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to cancel appointment");
  }
  revalidatePath("/appointments");
  revalidatePath(`/appointments/${appointmentId}`);
}

export async function noShowAppointmentAction(
  appointmentId: string,
): Promise<void> {
  await requireSession();
  try {
    await noShowAppointment(appointmentId);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to mark no-show");
  }
  revalidatePath("/appointments");
  revalidatePath(`/appointments/${appointmentId}`);
}

export async function voidAppointmentAction(
  appointmentId: string,
  formData: FormData,
): Promise<void> {
  await requireSession();
  const reason = str(formData, "reason") || undefined;
  try {
    await voidAppointment(appointmentId, reason);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to void appointment");
  }
  revalidatePath("/appointments");
  redirect("/appointments");
}

export async function restoreAppointmentAction(
  appointmentId: string,
): Promise<void> {
  await requireSession();
  try {
    await restoreAppointment(appointmentId);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to restore appointment");
  }
  revalidatePath(`/appointments/${appointmentId}`);
}

// --- recurring series ---

export async function createRecurrenceAction(
  _prev: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  await requireSession();

  const patientId = str(formData, "patientId");
  const appointmentTypeId = str(formData, "appointmentTypeId");
  const providerId = str(formData, "providerId") || null;
  const frequency = (str(formData, "frequency") ||
    "WEEKLY") as RecurrenceFrequency;
  const recurInterval = Number(str(formData, "recurInterval")) || 1;
  const days = formData.getAll("daysOfWeek").map((d) => d.toString());
  const daysOfWeek = days.length > 0 ? days.join(",") : null;
  const startDate = str(formData, "startDate");
  const endMode = str(formData, "endMode");
  const endDate = endMode === "date" ? str(formData, "endDate") || null : null;
  const occurrenceCount =
    endMode === "count"
      ? Number(str(formData, "occurrenceCount")) || null
      : null;
  const startTime = str(formData, "startTime");
  const durationMinutes = Number(str(formData, "durationMinutes")) || 30;
  const location = str(formData, "location") || null;

  if (!patientId) return { error: "A patient is required.", fieldErrors: {} };
  if (!appointmentTypeId) {
    return {
      error: "Appointment type is required.",
      fieldErrors: { appointmentTypeId: "Required" },
    };
  }
  if (!startDate)
    return {
      error: "Start date is required.",
      fieldErrors: { startDate: "Required" },
    };
  if (!startTime)
    return {
      error: "Start time is required.",
      fieldErrors: { startTime: "Required" },
    };
  if (!endDate && !occurrenceCount) {
    return {
      error: "Set either an end date or a number of occurrences.",
      fieldErrors: { endMode: "Required" },
    };
  }

  try {
    await createRecurrence({
      patientId,
      providerId,
      appointmentTypeId,
      frequency,
      recurInterval,
      daysOfWeek,
      startDate,
      endDate,
      occurrenceCount,
      startTime,
      durationMinutes,
      location,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        error: err.message || "Failed to create series",
        fieldErrors: Object.fromEntries(
          err.fields.map((f) => [f.path, f.message]),
        ),
      };
    }
    return { error: "Failed to create series", fieldErrors: {} };
  }

  revalidatePath("/appointments");
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}

export async function cancelRecurrenceAction(
  recurrenceId: string,
  patientId: string,
  formData: FormData,
): Promise<void> {
  await requireSession();
  const reason = str(formData, "reason") || undefined;
  try {
    await cancelRecurrence(recurrenceId, reason);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to cancel series");
  }
  revalidatePath("/appointments");
  revalidatePath(`/patients/${patientId}`);
}
