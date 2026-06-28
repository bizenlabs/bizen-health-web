"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import {
  createDictionaryEntry,
  deleteDictionaryEntry,
  type DictionaryEntryInput,
  restoreDictionaryEntry,
  retireDictionaryEntry,
  updateDictionaryEntry,
} from "@/lib/dictionary";

const LIST_PATH = "/settings/dictionary";

export type DictionaryActionResult = { ok: true } | { ok: false; error: string };

function str(formData: FormData, key: string): string {
  return (formData.get(key) ?? "").toString().trim();
}

/** Read + validate the editable fields off a submitted form. */
function readInput(formData: FormData): DictionaryEntryInput {
  const spokenForm = str(formData, "spokenForm");
  if (!spokenForm) {
    throw new ApiError(400, "Enter the word or phrase as spoken.", "INVALID");
  }
  const writtenForm = str(formData, "writtenForm");
  const language = str(formData, "language") || "en";
  return {
    spokenForm,
    writtenForm: writtenForm || null,
    language,
  };
}

function fromApiError(err: unknown, fallback: string): DictionaryActionResult {
  if (err instanceof ApiError) {
    return { ok: false, error: err.message || fallback };
  }
  throw err;
}

export async function createEntryAction(
  formData: FormData,
): Promise<DictionaryActionResult> {
  await requireRole("tenant_admin", "super_admin");
  try {
    await createDictionaryEntry(readInput(formData));
    revalidatePath(LIST_PATH);
    return { ok: true };
  } catch (err) {
    return fromApiError(err, "Could not add the entry.");
  }
}

export async function updateEntryAction(
  id: string,
  formData: FormData,
): Promise<DictionaryActionResult> {
  await requireRole("tenant_admin", "super_admin");
  try {
    await updateDictionaryEntry(id, readInput(formData));
    revalidatePath(LIST_PATH);
    return { ok: true };
  } catch (err) {
    return fromApiError(err, "Could not save the entry.");
  }
}

export async function retireEntryAction(
  id: string,
): Promise<DictionaryActionResult> {
  await requireRole("tenant_admin", "super_admin");
  try {
    await retireDictionaryEntry(id);
    revalidatePath(LIST_PATH);
    return { ok: true };
  } catch (err) {
    return fromApiError(err, "Could not remove the entry.");
  }
}

export async function restoreEntryAction(
  id: string,
): Promise<DictionaryActionResult> {
  await requireRole("tenant_admin", "super_admin");
  try {
    await restoreDictionaryEntry(id);
    revalidatePath(LIST_PATH);
    return { ok: true };
  } catch (err) {
    return fromApiError(err, "Could not restore the entry.");
  }
}

export async function deleteEntryAction(
  id: string,
): Promise<DictionaryActionResult> {
  await requireRole("tenant_admin", "super_admin");
  try {
    await deleteDictionaryEntry(id);
    revalidatePath(LIST_PATH);
    return { ok: true };
  } catch (err) {
    return fromApiError(err, "Could not delete the entry.");
  }
}
