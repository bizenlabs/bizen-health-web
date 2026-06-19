"use server";

import { revalidatePath } from "next/cache";
import { ApiError, ForbiddenError, UnauthorizedError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { type SetRateInput, setServiceRate } from "@/lib/usage";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Set the price for a meter. Super-admin only; the backend supersedes the
// active rate so historical usage keeps its original price.
export async function setServiceRateAction(
  input: SetRateInput,
): Promise<ActionResult<void>> {
  await requireRole("super_admin");
  try {
    await setServiceRate(input);
    revalidatePath("/admin/usage");
    return { ok: true, data: undefined };
  } catch (err) {
    if (err instanceof UnauthorizedError || err instanceof ForbiddenError) {
      throw err;
    }
    if (err instanceof ApiError) {
      return { ok: false, error: err.message || "Failed to save the rate." };
    }
    throw err;
  }
}
