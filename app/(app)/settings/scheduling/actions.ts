"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  addProviderAvailability,
  blockSlot,
  generateSlots,
  unblockSlot,
  voidProviderAvailability,
} from "@/lib/appointments";
import type { SchedulingState } from "./_components/scheduling-state";

function str(formData: FormData, key: string): string {
  return (formData.get(key) ?? "").toString().trim();
}

export async function addAvailabilityAction(
  providerId: string,
  _prev: SchedulingState,
  formData: FormData,
): Promise<SchedulingState> {
  await requireRole("tenant_admin", "super_admin");

  const dayOfWeek = str(formData, "dayOfWeek");
  const startTime = str(formData, "startTime");
  const endTime = str(formData, "endTime");
  const slotDurationMinutes = Number(str(formData, "slotDurationMinutes"));
  const effectiveFrom = str(formData, "effectiveFrom") || null;
  const effectiveTo = str(formData, "effectiveTo") || null;
  const location = str(formData, "location") || null;

  if (!dayOfWeek || !startTime || !endTime) {
    return { error: "Day, start and end time are required.", ok: null };
  }
  if (!Number.isFinite(slotDurationMinutes) || slotDurationMinutes <= 0) {
    return {
      error: "Slot duration must be a positive number of minutes.",
      ok: null,
    };
  }

  try {
    await addProviderAvailability({
      providerId,
      dayOfWeek,
      startTime,
      endTime,
      slotDurationMinutes,
      effectiveFrom,
      effectiveTo,
      location,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, ok: null };
    return { error: "Failed to add availability", ok: null };
  }

  revalidatePath("/settings/scheduling");
  return { error: null, ok: "Availability rule added." };
}

export async function voidAvailabilityAction(
  availabilityId: string,
  formData: FormData,
): Promise<void> {
  await requireRole("tenant_admin", "super_admin");
  const reason = str(formData, "reason") || undefined;
  try {
    await voidProviderAvailability(availabilityId, reason);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to remove availability");
  }
  revalidatePath("/settings/scheduling");
}

export async function generateSlotsAction(
  providerId: string,
  _prev: SchedulingState,
  formData: FormData,
): Promise<SchedulingState> {
  await requireRole("tenant_admin", "super_admin");
  const from = str(formData, "from");
  const to = str(formData, "to");
  if (!from || !to) {
    return { error: "Pick a date range to generate slots for.", ok: null };
  }

  let created: number;
  try {
    const res = await generateSlots(providerId, from, to);
    created = res.slotsCreated;
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message, ok: null };
    return { error: "Failed to generate slots", ok: null };
  }

  revalidatePath("/settings/scheduling");
  return {
    error: null,
    ok: `Generated ${created} slot${created === 1 ? "" : "s"}.`,
  };
}

export async function blockSlotAction(slotId: string): Promise<void> {
  await requireRole("tenant_admin", "super_admin");
  try {
    await blockSlot(slotId);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to block slot");
  }
  revalidatePath("/settings/scheduling");
}

export async function unblockSlotAction(slotId: string): Promise<void> {
  await requireRole("tenant_admin", "super_admin");
  try {
    await unblockSlot(slotId);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to unblock slot");
  }
  revalidatePath("/settings/scheduling");
}
