import "server-only";
import { api } from "@/lib/api";

/**
 * Custom dictionary — a clinic's own vocabulary for transcription. Each entry
 * pairs a `spokenForm` (fed to Deepgram as a key term so it's recognised) with
 * an optional `writtenForm` (how it should read in the note; null = leave as
 * spoken). Tenant-shared reference data, retired-not-deleted.
 *
 * Server-only BFF wrappers over the Spring `/v1/dictionary` surface. Reads are
 * open to any clinician (the recorders need the list); writes are the admin
 * dictionary settings page.
 */

export type DictionaryEntry = {
  id: string;
  spokenForm: string;
  writtenForm: string | null;
  language: string;
  retired: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Editable fields — the shape both create and update accept. */
export type DictionaryEntryInput = {
  spokenForm: string;
  writtenForm: string | null;
  language: string;
};

/** The tenant's dictionary; retired rows only when asked for. */
export const listDictionary = (includeRetired = false) =>
  api<DictionaryEntry[]>(
    `/v1/dictionary${includeRetired ? "?includeRetired=true" : ""}`,
  );

export const createDictionaryEntry = (body: DictionaryEntryInput) =>
  api<DictionaryEntry>("/v1/dictionary", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateDictionaryEntry = (id: string, body: DictionaryEntryInput) =>
  api<DictionaryEntry>(`/v1/dictionary/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

/** Retire (soft-delete) — drops out of recognition/replacement, kept for restore. */
export const retireDictionaryEntry = (id: string) =>
  api<DictionaryEntry>(`/v1/dictionary/${id}`, { method: "DELETE" });

/** Permanently delete an entry. */
export const deleteDictionaryEntry = (id: string) =>
  api<void>(`/v1/dictionary/${id}?purge=true`, { method: "DELETE" });

export const restoreDictionaryEntry = (id: string) =>
  api<DictionaryEntry>(`/v1/dictionary/${id}/restore`, { method: "POST" });
