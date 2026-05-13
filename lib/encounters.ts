import "server-only";
import { api } from "@/lib/api";

export type EncounterType = {
  id: string;
  name: string;
  description: string | null;
};

export type EncounterDetail = {
  id: string;
  patientId: string;
  encounterTypeId: string;
  encounterTypeName: string | null;
  encounterDatetime: string;
  location: string | null;
  notes: string | null;
  recordedBy: string | null;
  voided: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type RecordEncounterInput = {
  patientId: string;
  encounterTypeId: string;
  encounterDatetime: string;
  location: string | null;
  notes: string | null;
};

export type EditEncounterInput = {
  encounterTypeId: string;
  encounterDatetime: string;
  location: string | null;
  notes: string | null;
};

export const listEncountersForPatient = (
  patientId: string,
  p: { page?: number; size?: number } = {},
) =>
  api<PageResponse<EncounterDetail>>(
    `/v1/encounters?patientId=${patientId}&page=${p.page ?? 0}&size=${p.size ?? 50}`,
  );

export const getEncounter = (
  id: string,
  opts: { includeVoided?: boolean } = {},
) =>
  api<EncounterDetail>(
    `/v1/encounters/${id}${opts.includeVoided ? "?includeVoided=true" : ""}`,
  );

export const recordEncounter = (body: RecordEncounterInput) =>
  api<EncounterDetail>(`/v1/encounters`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const editEncounter = (id: string, body: EditEncounterInput) =>
  api<EncounterDetail>(`/v1/encounters/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const voidEncounter = (id: string, reason?: string) =>
  api<EncounterDetail>(
    `/v1/encounters/${id}` +
      (reason ? `?reason=${encodeURIComponent(reason)}` : ""),
    { method: "DELETE" },
  );

export const restoreEncounter = (id: string) =>
  api<EncounterDetail>(`/v1/encounters/${id}/restore`, { method: "POST" });

export const listEncounterTypes = () =>
  api<EncounterType[]>(`/v1/encounter-types`);
