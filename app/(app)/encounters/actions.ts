"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  editEncounter,
  recordEncounter,
  restoreEncounter,
  voidEncounter,
} from "@/lib/encounters";
import {
  recordObservation,
  restoreObservation,
  voidObservation,
} from "@/lib/observations";
import { ApiError } from "@/lib/api";
import type { EncounterFormState } from "./_components/encounter-form-state";
import type { ObservationActionState } from "./_components/observation-action-state";

function parseFields(formData: FormData) {
  const encounterTypeId = (formData.get("encounterTypeId") ?? "").toString();
  const dateStr = (formData.get("encounterDate") ?? "").toString().trim();
  const timeStr = (formData.get("encounterTime") ?? "").toString().trim();
  const location = (formData.get("location") ?? "").toString().trim() || null;
  const notes = (formData.get("notes") ?? "").toString().trim() || null;
  return { encounterTypeId, dateStr, timeStr, location, notes };
}

function buildDatetime(dateStr: string, timeStr: string): string | null {
  if (!dateStr) return null;
  const time = timeStr || "00:00";
  return `${dateStr}T${time}:00Z`;
}

export async function recordEncounterAction(
  patientId: string,
  _prev: EncounterFormState,
  formData: FormData,
): Promise<EncounterFormState> {
  await requireSession();
  const { encounterTypeId, dateStr, timeStr, location, notes } =
    parseFields(formData);
  if (!encounterTypeId) {
    return {
      error: "Encounter type is required.",
      fieldErrors: { encounterTypeId: "Required" },
    };
  }
  const encounterDatetime = buildDatetime(dateStr, timeStr);
  if (!encounterDatetime) {
    return {
      error: "Encounter date is required.",
      fieldErrors: { encounterDate: "Required" },
    };
  }

  let createdId: string;
  try {
    const created = await recordEncounter({
      patientId,
      encounterTypeId,
      encounterDatetime,
      location,
      notes,
    });
    createdId = created.id;
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        error: err.message || "Failed to record encounter",
        fieldErrors: Object.fromEntries(
          err.fields.map((f) => [f.path, f.message]),
        ),
      };
    }
    return { error: "Failed to record encounter", fieldErrors: {} };
  }

  revalidatePath(`/patients/${patientId}`);
  redirect(`/encounters/${createdId}`);
}

export async function editEncounterAction(
  encounterId: string,
  patientId: string,
  _prev: EncounterFormState,
  formData: FormData,
): Promise<EncounterFormState> {
  await requireSession();
  const { encounterTypeId, dateStr, timeStr, location, notes } =
    parseFields(formData);
  if (!encounterTypeId) {
    return {
      error: "Encounter type is required.",
      fieldErrors: { encounterTypeId: "Required" },
    };
  }
  const encounterDatetime = buildDatetime(dateStr, timeStr);
  if (!encounterDatetime) {
    return {
      error: "Encounter date is required.",
      fieldErrors: { encounterDate: "Required" },
    };
  }

  try {
    await editEncounter(encounterId, {
      encounterTypeId,
      encounterDatetime,
      location,
      notes,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        error: err.message || "Failed to update encounter",
        fieldErrors: Object.fromEntries(
          err.fields.map((f) => [f.path, f.message]),
        ),
      };
    }
    return { error: "Failed to update encounter", fieldErrors: {} };
  }

  revalidatePath(`/encounters/${encounterId}`);
  revalidatePath(`/patients/${patientId}`);
  redirect(`/encounters/${encounterId}`);
}

export async function voidEncounterAction(
  encounterId: string,
  patientId: string,
  formData: FormData,
): Promise<void> {
  await requireSession();
  const reason = (formData.get("reason") ?? "").toString().trim() || undefined;
  try {
    await voidEncounter(encounterId, reason);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to void encounter");
  }
  revalidatePath(`/encounters/${encounterId}`);
  revalidatePath(`/patients/${patientId}`);
  redirect(`/patients/${patientId}`);
}

export async function restoreEncounterAction(
  encounterId: string,
): Promise<void> {
  await requireSession();
  try {
    await restoreEncounter(encounterId);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to restore encounter");
  }
  revalidatePath(`/encounters/${encounterId}`);
}

const OBSERVATION_OK: ObservationActionState = { error: null };

export async function recordObservationAction(
  encounterId: string,
  _prev: ObservationActionState,
  formData: FormData,
): Promise<ObservationActionState> {
  await requireSession();
  const conceptId = (formData.get("conceptId") ?? "").toString();
  const dataType = (formData.get("dataType") ?? "").toString();
  const numericStr = (formData.get("valueNumeric") ?? "").toString().trim();
  const text = (formData.get("valueText") ?? "").toString().trim() || null;

  if (!conceptId) {
    return { error: "Concept is required." };
  }

  let valueNumeric: string | null = null;
  let valueText: string | null = null;
  if (dataType === "NUMERIC") {
    if (!numericStr) return { error: "Numeric value is required." };
    if (!Number.isFinite(Number(numericStr))) {
      return { error: "Numeric value must be a number." };
    }
    valueNumeric = numericStr;
  } else if (dataType === "TEXT") {
    if (!text) return { error: "Text value is required." };
    valueText = text;
  } else {
    return { error: "Unsupported concept data type." };
  }

  try {
    await recordObservation({
      encounterId,
      conceptId,
      valueNumeric,
      valueText,
      observedAt: null,
    });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: "Failed to record observation" };
  }
  revalidatePath(`/encounters/${encounterId}`);
  return OBSERVATION_OK;
}

export async function voidObservationAction(
  observationId: string,
  encounterId: string,
): Promise<void> {
  await requireSession();
  try {
    await voidObservation(observationId);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to void observation");
  }
  revalidatePath(`/encounters/${encounterId}`);
}

export async function restoreObservationAction(
  observationId: string,
  encounterId: string,
): Promise<void> {
  await requireSession();
  try {
    await restoreObservation(observationId);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to restore observation");
  }
  revalidatePath(`/encounters/${encounterId}`);
}
