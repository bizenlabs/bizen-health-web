"use server";

import { revalidatePath } from "next/cache";
import { ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import {
  createRefItem,
  type RegisterKey,
  restoreRefItem,
  retireRefItem,
  updateRefItem,
} from "@/lib/reference-data";
import type { RefDataActionState } from "./_components/ref-data-state";

const PATH = "/settings/reference-data";

/** Singular noun per register — for the user-facing action messages. */
const NOUN: Record<RegisterKey, string> = {
  "visit-types": "visit type",
  "encounter-types": "encounter type",
};

function str(formData: FormData, key: string): string {
  return (formData.get(key) ?? "").toString().trim();
}

function fail(error: string): RefDataActionState {
  return { error, savedAt: null };
}

export async function createRefItemAction(
  register: RegisterKey,
  _prev: RefDataActionState,
  formData: FormData,
): Promise<RefDataActionState> {
  await requireRole("tenant_admin", "super_admin");

  const name = str(formData, "name");
  const description = str(formData, "description");
  if (!name) return fail(`Enter a name for the ${NOUN[register]}.`);

  try {
    await createRefItem(register, { name, description: description || null });
  } catch (err) {
    if (err instanceof ApiError) return fail(err.message);
    return fail(`Could not add the ${NOUN[register]}.`);
  }

  revalidatePath(PATH);
  return { error: null, savedAt: Date.now() };
}

export async function updateRefItemAction(
  register: RegisterKey,
  id: string,
  _prev: RefDataActionState,
  formData: FormData,
): Promise<RefDataActionState> {
  await requireRole("tenant_admin", "super_admin");

  const name = str(formData, "name");
  const description = str(formData, "description");
  if (!name) return fail(`Enter a name for the ${NOUN[register]}.`);

  try {
    await updateRefItem(register, id, {
      name,
      description: description || null,
    });
  } catch (err) {
    if (err instanceof ApiError) return fail(err.message);
    return fail("Could not save your changes.");
  }

  revalidatePath(PATH);
  return { error: null, savedAt: Date.now() };
}

export async function retireRefItemAction(
  register: RegisterKey,
  id: string,
): Promise<void> {
  await requireRole("tenant_admin", "super_admin");
  try {
    await retireRefItem(register, id);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error(`Could not retire the ${NOUN[register]}.`);
  }
  revalidatePath(PATH);
}

export async function restoreRefItemAction(
  register: RegisterKey,
  id: string,
): Promise<void> {
  await requireRole("tenant_admin", "super_admin");
  try {
    await restoreRefItem(register, id);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error(`Could not restore the ${NOUN[register]}.`);
  }
  revalidatePath(PATH);
}
