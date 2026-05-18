"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  appendSegmentsAction,
  completeTranscriptionAction,
  failTranscriptionAction,
  mintDeepgramKeyAction,
  startTranscriptionAction,
} from "@/app/(app)/transcription-actions";
import type {
  SegmentInput,
  StartTranscriptionInput,
  TranscriptionDetail,
} from "@/lib/transcriptions";
import { type AudioCapture, createAudioCapture } from "./audio-capture";
import { createDeepgramStream } from "./deepgram-client";
import type { TranscriptEvent, TranscriptionStream } from "./types";

// Orchestrates one browser-side transcription session, shared by the encounter
// recorder and the dictation page. Audio streams browser → Deepgram directly;
// finalised utterances are batched and flushed to the backend (every
// FLUSH_BATCH finals, or FLUSH_IDLE_MS after the last one, and on stop) so a
// mid-session crash loses at most the last few utterances.

export type RecorderState =
  | "idle"
  | "starting"
  | "recording"
  | "stopping"
  | "error";

export type LiveSegment = SegmentInput;

export interface UseTranscriptionResult {
  state: RecorderState;
  error: string | null;
  transcriptionId: string | null;
  segments: LiveSegment[];
  partial: { text: string; speakerIndex: number | null } | null;
  start: (
    input: StartTranscriptionInput,
    opts?: { deviceId?: string | null; existingId?: string },
  ) => Promise<void>;
  stop: () => Promise<TranscriptionDetail | null>;
}

const FLUSH_BATCH = 5;
const FLUSH_IDLE_MS = 4000;

export function useTranscription(): UseTranscriptionResult {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcriptionId, setTranscriptionId] = useState<string | null>(null);
  const [segments, setSegments] = useState<LiveSegment[]>([]);
  const [partial, setPartial] =
    useState<UseTranscriptionResult["partial"]>(null);

  const streamRef = useRef<TranscriptionStream | null>(null);
  const captureRef = useRef<AudioCapture | null>(null);
  const idRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const seqRef = useRef<number>(0);
  const pendingRef = useRef<LiveSegment[]>([]);
  const flushingRef = useRef<boolean>(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  // Sends whatever finals are buffered. On failure the batch is re-queued so
  // the next flush (or stop) retries it.
  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    const id = idRef.current;
    if (!id || pendingRef.current.length === 0) return;
    clearFlushTimer();
    const batch = pendingRef.current;
    pendingRef.current = [];
    flushingRef.current = true;
    try {
      const res = await appendSegmentsAction(id, batch);
      if (!res.ok) {
        pendingRef.current = [...batch, ...pendingRef.current];
        setError(res.error);
      }
    } catch {
      pendingRef.current = [...batch, ...pendingRef.current];
    } finally {
      flushingRef.current = false;
    }
  }, [clearFlushTimer]);

  const scheduleIdleFlush = useCallback(() => {
    clearFlushTimer();
    flushTimerRef.current = setTimeout(() => void flush(), FLUSH_IDLE_MS);
  }, [clearFlushTimer, flush]);

  const handleEvent = useCallback(
    (e: TranscriptEvent) => {
      if (e.kind === "error") {
        setError(e.error.message);
        setState("error");
        return;
      }
      if (e.kind === "closed") {
        return;
      }
      if (e.kind === "partial") {
        setPartial({ text: e.text, speakerIndex: e.speaker ?? null });
        return;
      }
      // final
      const offsetMs = Math.max(0, e.ts - startedAtRef.current);
      const segment: LiveSegment = {
        sequence: seqRef.current++,
        speakerIndex: e.speaker ?? null,
        text: e.text,
        startOffsetMs: offsetMs,
        endOffsetMs: offsetMs,
      };
      setSegments((prev) => [...prev, segment]);
      setPartial(null);
      pendingRef.current.push(segment);
      if (pendingRef.current.length >= FLUSH_BATCH) {
        void flush();
      } else {
        scheduleIdleFlush();
      }
    },
    [flush, scheduleIdleFlush],
  );

  const teardown = useCallback(async () => {
    clearFlushTimer();
    try {
      await captureRef.current?.stop();
    } catch {
      /* best effort */
    }
    try {
      await streamRef.current?.close();
    } catch {
      /* best effort */
    }
    captureRef.current = null;
    streamRef.current = null;
  }, [clearFlushTimer]);

  const start = useCallback(
    async (
      input: StartTranscriptionInput,
      opts?: { deviceId?: string | null; existingId?: string },
    ) => {
      setError(null);
      setState("starting");
      setSegments([]);
      setPartial(null);
      pendingRef.current = [];
      seqRef.current = 0;
      idRef.current = null;
      setTranscriptionId(null);
      try {
        // When the session was already created (the unified editor flow mints
        // it at intake so it has an id to navigate to), skip the create and
        // just stream audio into it.
        if (opts?.existingId) {
          idRef.current = opts.existingId;
          setTranscriptionId(opts.existingId);
        } else {
          const created = await startTranscriptionAction(input);
          if (!created.ok) throw new Error(created.error);
          idRef.current = created.data.id;
          setTranscriptionId(created.data.id);
        }
        startedAtRef.current = Date.now();

        const stream = createDeepgramStream({
          diarize: input.mode === "ENCOUNTER",
        });
        streamRef.current = stream;
        stream.on(handleEvent);

        // Start the mic before the WS handshake — sendPcm() buffers frames
        // until the socket opens, so the first words survive token fetch +
        // connect.
        const capture = createAudioCapture(opts?.deviceId ?? undefined);
        captureRef.current = capture;
        await capture.start((chunk) => stream.sendPcm(chunk));

        await stream.connect({
          getToken: async () => {
            const id = idRef.current;
            if (!id) throw new Error("transcription session not created");
            const key = await mintDeepgramKeyAction(id);
            if (!key.ok) throw new Error(key.error);
            return key.data.apiKey;
          },
        });
        setState("recording");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setState("error");
        await teardown();
        const id = idRef.current;
        if (id) void failTranscriptionAction(id, "failed to start recording");
      }
    },
    [handleEvent, teardown],
  );

  const stop = useCallback(async (): Promise<TranscriptionDetail | null> => {
    setState("stopping");
    await teardown();
    await flush();
    const id = idRef.current;
    if (!id) {
      setState("idle");
      return null;
    }
    const res = await completeTranscriptionAction(id, {
      endedAt: new Date().toISOString(),
    });
    if (res.ok) {
      setState("idle");
      return res.data;
    }
    setError(res.error);
    setState("error");
    return null;
  }, [flush, teardown]);

  // Tear down capture + socket if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      void captureRef.current?.stop();
      void streamRef.current?.close();
    };
  }, []);

  return { state, error, transcriptionId, segments, partial, start, stop };
}
