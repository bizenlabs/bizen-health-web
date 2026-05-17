import "server-only";
import { api } from "@/lib/api";

// Mirrors the bizen-health-core transcriptions module DTOs
// (/v1/transcriptions). The browser streams audio directly to Deepgram; this
// BFF layer only ever moves the resulting text + session metadata.

export type TranscriptionMode = "ENCOUNTER" | "DICTATION";
export type TranscriptionStatus = "IN_PROGRESS" | "COMPLETED" | "FAILED";

export type TranscriptSegment = {
  id: string;
  sequence: number;
  speakerIndex: number | null;
  speakerLabel: string | null;
  text: string;
  startOffsetMs: number;
  endOffsetMs: number;
};

export type TranscriptSpeaker = {
  speakerIndex: number;
  label: string;
};

export type TranscriptionDetail = {
  id: string;
  mode: TranscriptionMode;
  encounterId: string | null;
  patientId: string | null;
  templateId: string | null;
  status: TranscriptionStatus;
  language: string;
  deepgramRequestId: string | null;
  startedAt: string;
  endedAt: string | null;
  recordedBy: string | null;
  noteContent: string | null;
  failureReason: string | null;
  voided: boolean;
  createdAt: string;
  updatedAt: string;
  segments: TranscriptSegment[];
  speakers: TranscriptSpeaker[];
};

export type TranscriptionSummary = {
  id: string;
  mode: TranscriptionMode;
  encounterId: string | null;
  patientId: string | null;
  templateId: string | null;
  status: TranscriptionStatus;
  language: string;
  startedAt: string;
  endedAt: string | null;
  recordedBy: string | null;
  segmentCount: number;
  voided: boolean;
  createdAt: string;
  updatedAt: string;
};

// A short-lived Deepgram key. The browser opens the Deepgram streaming
// WebSocket directly with this — it never proxies audio through the platform.
export type DeepgramKey = {
  apiKey: string;
  expiresAt: string;
  ttlSeconds: number;
};

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type StartTranscriptionInput = {
  mode: TranscriptionMode;
  encounterId?: string | null;
  patientId?: string | null;
  templateId?: string | null;
  language?: string | null;
};

// One finalised utterance. Offsets are milliseconds from recording start.
export type SegmentInput = {
  sequence: number;
  speakerIndex: number | null;
  text: string;
  startOffsetMs: number;
  endOffsetMs: number;
};

export const startTranscription = (body: StartTranscriptionInput) =>
  api<TranscriptionDetail>(`/v1/transcriptions`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const mintDeepgramKey = (id: string) =>
  api<DeepgramKey>(`/v1/transcriptions/${id}/deepgram-key`, { method: "POST" });

export const appendSegments = (id: string, segments: SegmentInput[]) =>
  api<TranscriptionDetail>(`/v1/transcriptions/${id}/segments`, {
    method: "POST",
    body: JSON.stringify({ segments }),
  });

export const completeTranscription = (
  id: string,
  body: { endedAt?: string | null; deepgramRequestId?: string | null } = {},
) =>
  api<TranscriptionDetail>(`/v1/transcriptions/${id}/complete`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const failTranscription = (id: string, reason?: string) =>
  api<TranscriptionDetail>(
    `/v1/transcriptions/${id}/fail` +
      (reason ? `?reason=${encodeURIComponent(reason)}` : ""),
    { method: "POST" },
  );

export const editTranscriptionNote = (
  id: string,
  body: { noteContent: string | null; templateId: string | null },
) =>
  api<TranscriptionDetail>(`/v1/transcriptions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const labelSpeaker = (id: string, speakerIndex: number, label: string) =>
  api<TranscriptionDetail>(
    `/v1/transcriptions/${id}/speakers/${speakerIndex}`,
    { method: "PATCH", body: JSON.stringify({ label }) },
  );

export const getTranscription = (
  id: string,
  opts: { includeVoided?: boolean } = {},
) =>
  api<TranscriptionDetail>(
    `/v1/transcriptions/${id}${opts.includeVoided ? "?includeVoided=true" : ""}`,
  );

export const listTranscriptionsForEncounter = (encounterId: string) =>
  api<TranscriptionSummary[]>(`/v1/transcriptions?encounterId=${encounterId}`);

export const listMyDictations = (p: { page?: number; size?: number } = {}) =>
  api<PageResponse<TranscriptionSummary>>(
    `/v1/transcriptions?mine=true&page=${p.page ?? 0}&size=${p.size ?? 50}`,
  );

export const voidTranscription = (id: string, reason?: string) =>
  api<TranscriptionDetail>(
    `/v1/transcriptions/${id}` +
      (reason ? `?reason=${encodeURIComponent(reason)}` : ""),
    { method: "DELETE" },
  );

export const restoreTranscription = (id: string) =>
  api<TranscriptionDetail>(`/v1/transcriptions/${id}/restore`, {
    method: "POST",
  });
