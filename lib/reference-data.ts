import "server-only";
import { api } from "@/lib/api";

/**
 * Reference data — the tenant-scoped lookup lists a clinic admin curates for
 * itself. Every register has the same shape and the same CRUD surface, so the
 * settings section is generic over a {@link RegisterKey}.
 *
 * Entries are retired, never deleted: a retired entry stays referenceable by
 * the historical records that already point at it, but drops out of the
 * default list and the new-record pickers.
 */

/** One editable reference-data entry — every register shares this shape. */
export type RefItem = {
  id: string;
  name: string;
  description: string | null;
  retired: boolean;
};

/** Editable fields of an entry — the shape both create and update accept. */
export type RefItemInput = {
  name: string;
  description: string | null;
};

/** The reference-data registers a clinic admin can curate. */
export type RegisterKey = "visit-types" | "encounter-types";

const REGISTER_PATH: Record<RegisterKey, string> = {
  "visit-types": "/v1/visit-types",
  "encounter-types": "/v1/encounter-types",
};

/**
 * Entries in a register, ordered by name. Retired entries are omitted unless
 * {@link includeRetired} is set — the admin "show retired" view.
 */
export const listRefItems = (key: RegisterKey, includeRetired = false) =>
  api<RefItem[]>(
    `${REGISTER_PATH[key]}${includeRetired ? "?includeRetired=true" : ""}`,
  );

export const createRefItem = (key: RegisterKey, body: RefItemInput) =>
  api<RefItem>(REGISTER_PATH[key], {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateRefItem = (
  key: RegisterKey,
  id: string,
  body: RefItemInput,
) =>
  api<RefItem>(`${REGISTER_PATH[key]}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

/** Retire (soft-delete) an entry — hidden from new records, kept for history. */
export const retireRefItem = (key: RegisterKey, id: string) =>
  api<RefItem>(`${REGISTER_PATH[key]}/${id}`, { method: "DELETE" });

/** Bring a retired entry back into use. */
export const restoreRefItem = (key: RegisterKey, id: string) =>
  api<RefItem>(`${REGISTER_PATH[key]}/${id}/restore`, { method: "POST" });
