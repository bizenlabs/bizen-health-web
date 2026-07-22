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
import { DEFAULT_TRANSCRIPTION_LANGUAGE } from "./languages";
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
  | "paused"
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
    opts?: {
      deviceId?: string | null;
      existingId?: string;
      // Finalised segments already persisted on the session — supplied when
      // resuming a dictation so the live view shows them and new segments are
      // numbered after, not over, them.
      seedSegments?: LiveSegment[];
      // The clinic's custom-dictionary spoken forms, sent to Deepgram as key
      // terms to improve recognition. Persisted for the session so a mic switch
      // reconnects with the same vocabulary.
      keyterms?: string[];
      // The tenant's transcription language/accent (Deepgram BCP-47 tag).
      // Persisted for the session so a mic-switch reconnect keeps it.
      language?: string;
      // Spoken-punctuation mode — the speaker dictates punctuation, so the
      // stream connects with Deepgram auto-punctuation off. Persisted for the
      // session so a mic-switch reconnect keeps it.
      spokenPunctuation?: boolean;
    },
  ) => Promise<void>;
  // Mute the mic + gate audio without tearing down the Deepgram WS or the
  // backend session — resume() picks up in the same session without re-minting
  // a token or reconnecting. For the heavy "fully stop then start again"
  // path, finalise with stop() and the page-level reopen flow.
  pause: () => void;
  resume: () => void;
  // Swap the live recording onto a different microphone without ending the
  // session — re-acquires the mic and reconnects the Deepgram socket while
  // keeping the transcription id, accumulated segments, and sequence numbering
  // intact. A no-op unless a session is live.
  switchDevice: (deviceId: string | null) => Promise<void>;
  // Flip spoken-punctuation mode. It's a Deepgram connection parameter, so a
  // live session keeps its current stream until reconnected — call
  // switchDevice with the current mic right after to apply it immediately.
  setSpokenPunctuation: (on: boolean) => void;
  stop: () => Promise<TranscriptionDetail | null>;
  // Current input loudness in [0, 1] — read on an animation frame to drive the
  // live level meter. Stable identity; safe to depend on.
  getLevel: () => number;
  // Whether the mic is muted at the source (e.g. closed laptop lid). Polled to
  // surface a silent-but-live mic. Stable identity; safe to depend on.
  isMuted: () => boolean;
}

const FLUSH_BATCH = 5;
const FLUSH_IDLE_MS = 4000;
// Matches the Deepgram stream + capture sample rate; used to convert streamed
// PCM sample counts into billable audio seconds.
const SAMPLE_RATE = 16000;

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
  // The input the current session was started with — replayed by switchDevice
  // so the reconnected stream keeps the same mode (diarization on/off).
  const inputRef = useRef<StartTranscriptionInput | null>(null);
  // Custom-dictionary key terms for this session, replayed on a mic switch so
  // the reconnected Deepgram stream keeps the same vocabulary.
  const keytermsRef = useRef<string[]>([]);
  const languageRef = useRef<string>(DEFAULT_TRANSCRIPTION_LANGUAGE);
  // Spoken-punctuation mode for this session — read at (re)connect time so a
  // mid-session toggle takes effect on the next reconnect.
  const spokenPunctuationRef = useRef<boolean>(false);
  // True between session creation and an explicit stop()/failure. The unmount
  // cleanup uses it to finalise a session abandoned by a client-side nav.
  const liveRef = useRef<boolean>(false);
  const startedAtRef = useRef<number>(0);
  const seqRef = useRef<number>(0);
  // Usage metering for this sitting. streamedSamples is the audio we actually
  // sent to Deepgram (accumulates across mic switches / reconnects, gated by
  // pause); metaDuration/requestId come from Deepgram's end-of-stream Metadata
  // when it arrives before close. recordedSeconds() reconciles the two.
  const streamedSamplesRef = useRef<number>(0);
  const metaDurationRef = useRef<number>(0);
  const requestIdRef = useRef<string | null>(null);
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

  // Billable audio seconds for this sitting: the larger of Deepgram's reported
  // duration and what we streamed, rounded to milliseconds.
  const recordedSeconds = useCallback((): number => {
    const streamed = streamedSamplesRef.current / SAMPLE_RATE;
    return (
      Math.round(Math.max(streamed, metaDurationRef.current) * 1000) / 1000
    );
  }, []);

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
      if (e.kind === "metadata") {
        // Deepgram's own duration is authoritative for a single stream; keep
        // the larger of it and our streamed-sample estimate so a multi-stream
        // (mic-switched) sitting isn't undercounted by the last stream's meta.
        metaDurationRef.current = Math.max(
          metaDurationRef.current,
          e.durationSeconds,
        );
        if (e.requestId) requestIdRef.current = e.requestId;
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
      opts?: {
        deviceId?: string | null;
        existingId?: string;
        seedSegments?: LiveSegment[];
        keyterms?: string[];
        language?: string;
        spokenPunctuation?: boolean;
      },
    ) => {
      const seed = opts?.seedSegments ?? [];
      inputRef.current = input;
      keytermsRef.current = opts?.keyterms ?? [];
      languageRef.current = opts?.language ?? DEFAULT_TRANSCRIPTION_LANGUAGE;
      spokenPunctuationRef.current = opts?.spokenPunctuation ?? false;
      setError(null);
      setState("starting");
      setSegments(seed);
      setPartial(null);
      pendingRef.current = [];
      streamedSamplesRef.current = 0;
      metaDurationRef.current = 0;
      requestIdRef.current = null;
      // Continue numbering after the seeded segments so a resumed recording
      // appends to the dictation rather than colliding with existing rows.
      seqRef.current = seed.reduce(
        (max, s) => Math.max(max, s.sequence + 1),
        0,
      );
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
        liveRef.current = true;
        startedAtRef.current = Date.now();

        const stream = createDeepgramStream({
          diarize: input.mode === "ENCOUNTER",
          keyterms: keytermsRef.current,
          language: languageRef.current,
          spokenPunctuation: spokenPunctuationRef.current,
        });
        streamRef.current = stream;
        stream.on(handleEvent);

        // Start the mic before the WS handshake — sendPcm() buffers frames
        // until the socket opens, so the first words survive token fetch +
        // connect.
        const capture = createAudioCapture(opts?.deviceId ?? undefined);
        captureRef.current = capture;
        await capture.start((chunk) => {
          // Count audio actually streamed to Deepgram — the billable signal.
          streamedSamplesRef.current += chunk.length;
          stream.sendPcm(chunk);
        });

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
        liveRef.current = false;
        setError(err instanceof Error ? err.message : String(err));
        setState("error");
        await teardown();
        const id = idRef.current;
        if (id) void failTranscriptionAction(id, "failed to start recording");
      }
    },
    [handleEvent, teardown],
  );

  const pause = useCallback(() => {
    if (!captureRef.current) return;
    captureRef.current.pause();
    // Any in-flight partial won't be finalised once audio goes silent; clear
    // it so the UI doesn't show a stale italicised tail while paused.
    setPartial(null);
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    if (!captureRef.current) return;
    captureRef.current.resume();
    setState("recording");
  }, []);

  const switchDevice = useCallback(
    async (deviceId: string | null) => {
      const id = idRef.current;
      const input = inputRef.current;
      // Only swap a live session — there's nothing to re-point otherwise.
      if (!id || !input || !liveRef.current) return;
      setState("starting");
      setPartial(null);
      // Persist whatever's buffered before tearing the old pipe down, then
      // drop the old capture + socket. The session id and segments survive.
      await flush();
      await teardown();
      try {
        const stream = createDeepgramStream({
          diarize: input.mode === "ENCOUNTER",
          keyterms: keytermsRef.current,
          language: languageRef.current,
          spokenPunctuation: spokenPunctuationRef.current,
        });
        streamRef.current = stream;
        stream.on(handleEvent);

        const capture = createAudioCapture(deviceId ?? undefined);
        captureRef.current = capture;
        await capture.start((chunk) => {
          // Count audio actually streamed to Deepgram — the billable signal.
          streamedSamplesRef.current += chunk.length;
          stream.sendPcm(chunk);
        });

        await stream.connect({
          getToken: async () => {
            const key = await mintDeepgramKeyAction(id);
            if (!key.ok) throw new Error(key.error);
            return key.data.apiKey;
          },
        });
        setState("recording");
      } catch (err) {
        // Leave the session IN_PROGRESS (don't fail it) so the clinician can
        // pick another mic and try again, or resume it in a later sitting.
        setError(err instanceof Error ? err.message : String(err));
        setState("error");
        await teardown();
      }
    },
    [flush, handleEvent, teardown],
  );

  const setSpokenPunctuation = useCallback((on: boolean) => {
    spokenPunctuationRef.current = on;
  }, []);

  const stop = useCallback(async (): Promise<TranscriptionDetail | null> => {
    liveRef.current = false;
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
      deepgramRequestId: requestIdRef.current ?? undefined,
      audioSeconds: recordedSeconds(),
    });
    if (res.ok) {
      setState("idle");
      return res.data;
    }
    setError(res.error);
    setState("error");
    return null;
  }, [flush, teardown, recordedSeconds]);

  // Read straight off the capture each frame — no state, no re-render. Returns
  // 0 whenever nothing is capturing.
  const getLevel = useCallback(() => captureRef.current?.getLevel() ?? 0, []);

  // Whether the mic is muted at the source (e.g. a closed laptop lid). Polled
  // by the meter so a silent-but-live mic surfaces as "no signal" rather than
  // an unexplained flat meter.
  const isMuted = useCallback(() => captureRef.current?.isMuted() ?? false, []);

  // Tear down capture + socket if the component unmounts mid-recording.
  // A client-side navigation away never calls stop(), so without this the
  // backend session would be stranded IN_PROGRESS forever. Implicitly finalise
  // it — flush whatever was buffered, then complete — so it lands as a normal
  // dictation. (A full page unload is handled separately by a beforeunload
  // warning; sendBeacon-style finalisation there is out of scope.)
  useEffect(() => {
    return () => {
      void captureRef.current?.stop();
      void streamRef.current?.close();
      clearFlushTimer();
      const id = idRef.current;
      if (!id || !liveRef.current) return;
      liveRef.current = false;
      const buffered = pendingRef.current;
      pendingRef.current = [];
      void (async () => {
        if (buffered.length > 0) {
          await appendSegmentsAction(id, buffered).catch(() => {});
        }
        const streamed = streamedSamplesRef.current / SAMPLE_RATE;
        const audioSeconds =
          Math.round(Math.max(streamed, metaDurationRef.current) * 1000) / 1000;
        await completeTranscriptionAction(id, {
          endedAt: new Date().toISOString(),
          deepgramRequestId: requestIdRef.current ?? undefined,
          audioSeconds,
        }).catch(() => {});
      })();
    };
  }, [clearFlushTimer]);

  return {
    state,
    error,
    transcriptionId,
    segments,
    partial,
    start,
    pause,
    resume,
    switchDevice,
    setSpokenPunctuation,
    stop,
    getLevel,
    isMuted,
  };
}
