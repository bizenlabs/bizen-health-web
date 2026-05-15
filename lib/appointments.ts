import "server-only";
import { api } from "@/lib/api";

export type AppointmentStatus =
  | "SCHEDULED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type AppointmentKind = "SCHEDULED" | "WALK_IN";

export type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY";

export type SlotStatus = "OPEN" | "BLOCKED";

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type AppointmentType = {
  id: string;
  name: string;
  description: string | null;
  defaultDurationMinutes: number | null;
  color: string | null;
};

export type AppointmentDetail = {
  id: string;
  patientId: string;
  providerId: string | null;
  appointmentTypeId: string;
  appointmentTypeName: string | null;
  slotId: string | null;
  recurrenceId: string | null;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  kind: AppointmentKind;
  reason: string | null;
  notes: string | null;
  location: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  cancelReason: string | null;
  fulfillingEncounterId: string | null;
  voided: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProviderAvailability = {
  id: string;
  providerId: string;
  /** Java `DayOfWeek` name, e.g. "MONDAY". */
  dayOfWeek: string;
  /** "HH:mm:ss" clinic-local wall time. */
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  location: string | null;
};

export type AppointmentSlot = {
  id: string;
  providerId: string;
  startAt: string;
  endAt: string;
  status: SlotStatus;
  sourceAvailabilityId: string | null;
  location: string | null;
  /** True when a live appointment occupies this slot. */
  booked: boolean;
};

export type AppointmentRecurrence = {
  id: string;
  patientId: string;
  providerId: string | null;
  appointmentTypeId: string;
  frequency: RecurrenceFrequency;
  recurInterval: number;
  daysOfWeek: string | null;
  startDate: string;
  endDate: string | null;
  occurrenceCount: number | null;
  startTime: string;
  durationMinutes: number;
  location: string | null;
  voided: boolean;
};

// --- input types ---

export type BookAppointmentInput = {
  patientId: string;
  providerId?: string | null;
  appointmentTypeId: string;
  slotId?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  kind?: AppointmentKind | null;
  reason?: string | null;
  notes?: string | null;
  location?: string | null;
};

export type RescheduleInput = {
  providerId?: string | null;
  appointmentTypeId: string;
  slotId?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  reason?: string | null;
  notes?: string | null;
  location?: string | null;
};

export type AvailabilityInput = {
  providerId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  location?: string | null;
};

export type CreateRecurrenceInput = {
  patientId: string;
  providerId?: string | null;
  appointmentTypeId: string;
  frequency: RecurrenceFrequency;
  recurInterval?: number | null;
  daysOfWeek?: string | null;
  startDate: string;
  endDate?: string | null;
  occurrenceCount?: number | null;
  startTime: string;
  durationMinutes: number;
  location?: string | null;
};

// --- appointments ---

export const bookAppointment = (body: BookAppointmentInput) =>
  api<AppointmentDetail>(`/v1/appointments`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const listAppointmentsForPatient = (
  patientId: string,
  p: { page?: number; size?: number } = {},
) =>
  api<PageResponse<AppointmentDetail>>(
    `/v1/appointments?patientId=${patientId}&page=${p.page ?? 0}&size=${p.size ?? 50}`,
  );

/** Day list — the backend returns a plain array (not paged). */
export const listAppointmentsForDay = (date: string, providerId?: string) => {
  const params = new URLSearchParams({ date });
  if (providerId) params.set("providerId", providerId);
  return api<AppointmentDetail[]>(`/v1/appointments?${params.toString()}`);
};

export const getAppointment = (
  id: string,
  opts: { includeVoided?: boolean } = {},
) =>
  api<AppointmentDetail>(
    `/v1/appointments/${id}${opts.includeVoided ? "?includeVoided=true" : ""}`,
  );

export const rescheduleAppointment = (id: string, body: RescheduleInput) =>
  api<AppointmentDetail>(`/v1/appointments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const checkInAppointment = (id: string) =>
  api<AppointmentDetail>(`/v1/appointments/${id}/check-in`, { method: "POST" });

export const completeAppointment = (
  id: string,
  body: { fulfillingEncounterId?: string | null } = {},
) =>
  api<AppointmentDetail>(`/v1/appointments/${id}/complete`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const cancelAppointment = (id: string, reason?: string) =>
  api<AppointmentDetail>(
    `/v1/appointments/${id}/cancel` +
      (reason ? `?reason=${encodeURIComponent(reason)}` : ""),
    { method: "POST" },
  );

export const noShowAppointment = (id: string) =>
  api<AppointmentDetail>(`/v1/appointments/${id}/no-show`, { method: "POST" });

export const voidAppointment = (id: string, reason?: string) =>
  api<AppointmentDetail>(
    `/v1/appointments/${id}` +
      (reason ? `?reason=${encodeURIComponent(reason)}` : ""),
    { method: "DELETE" },
  );

export const restoreAppointment = (id: string) =>
  api<AppointmentDetail>(`/v1/appointments/${id}/restore`, { method: "POST" });

// --- reference data ---

export const listAppointmentTypes = () =>
  api<AppointmentType[]>(`/v1/appointment-types`);

// --- provider availability ---

export const listProviderAvailability = (providerId: string) =>
  api<ProviderAvailability[]>(
    `/v1/provider-availability?providerId=${providerId}`,
  );

export const addProviderAvailability = (body: AvailabilityInput) =>
  api<ProviderAvailability>(`/v1/provider-availability`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const voidProviderAvailability = (id: string, reason?: string) =>
  api<void>(
    `/v1/provider-availability/${id}` +
      (reason ? `?reason=${encodeURIComponent(reason)}` : ""),
    { method: "DELETE" },
  );

// --- slots ---

export const generateSlots = (providerId: string, from: string, to: string) =>
  api<{ slotsCreated: number }>(
    `/v1/appointment-slots/generate?providerId=${providerId}&from=${from}&to=${to}`,
    { method: "POST" },
  );

export const listSlots = (providerId: string, from: string, to: string) =>
  api<AppointmentSlot[]>(
    `/v1/appointment-slots?providerId=${providerId}&from=${from}&to=${to}`,
  );

export const blockSlot = (id: string) =>
  api<AppointmentSlot>(`/v1/appointment-slots/${id}/block`, { method: "POST" });

export const unblockSlot = (id: string) =>
  api<AppointmentSlot>(`/v1/appointment-slots/${id}/unblock`, {
    method: "POST",
  });

// --- recurring series ---

export const createRecurrence = (body: CreateRecurrenceInput) =>
  api<AppointmentRecurrence>(`/v1/appointment-recurrences`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const getRecurrence = (id: string) =>
  api<AppointmentRecurrence>(`/v1/appointment-recurrences/${id}`);

export const listRecurrencesForPatient = (patientId: string) =>
  api<AppointmentRecurrence[]>(
    `/v1/appointment-recurrences?patientId=${patientId}`,
  );

export const cancelRecurrence = (id: string, reason?: string) =>
  api<AppointmentRecurrence>(
    `/v1/appointment-recurrences/${id}` +
      (reason ? `?reason=${encodeURIComponent(reason)}` : ""),
    { method: "DELETE" },
  );
