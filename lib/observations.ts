import "server-only";
import { api } from "@/lib/api";

export type ConceptDataType = "NUMERIC" | "TEXT";

export type Concept = {
  id: string;
  name: string;
  description: string | null;
  dataType: ConceptDataType;
  units: string | null;
};

export type Observation = {
  id: string;
  encounterId: string;
  patientId: string;
  conceptId: string;
  conceptName: string | null;
  valueNumeric: string | null;
  valueText: string | null;
  valueUnits: string | null;
  observedAt: string;
  recordedBy: string | null;
  voided: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecordObservationInput = {
  encounterId: string;
  conceptId: string;
  valueNumeric: string | null;
  valueText: string | null;
  observedAt: string | null;
};

export const listConcepts = () => api<Concept[]>(`/v1/concepts`);

export const listObservationsForEncounter = (encounterId: string) =>
  api<Observation[]>(`/v1/observations?encounterId=${encounterId}`);

export const recordObservation = (body: RecordObservationInput) =>
  api<Observation>(`/v1/observations`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const voidObservation = (id: string, reason?: string) =>
  api<Observation>(
    `/v1/observations/${id}` +
      (reason ? `?reason=${encodeURIComponent(reason)}` : ""),
    { method: "DELETE" },
  );

export const restoreObservation = (id: string) =>
  api<Observation>(`/v1/observations/${id}/restore`, { method: "POST" });
