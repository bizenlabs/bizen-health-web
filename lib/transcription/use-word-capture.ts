"use client";

import { useCallback, useRef, useState } from "react";
import { mintScratchDeepgramKeyAction } from "@/app/(app)/transcription-actions";
import { type AudioCapture, createAudioCapture } from "./audio-capture";
import { createDeepgramStream } from "./deepgram-client";
import type { TranscriptionStream } from "./types";

// One-shot voice capture for the dictionary "record a word" affordance — the
// Nabla flow: speak a term, see it transcribed, edit, save. Reuses the same
// mic + Deepgram pipeline as a full session but without diarization, segment
// persistence, or a transcription record: it mints a session-less ephemeral key
// and returns the finalised text for the caller to drop into a form field.

export type WordCaptureState = "idle" | "recording" | "error";

export interface UseWordCapture {
  state: WordCaptureState;
  /** Live interim text while recording — show it so the user sees progress. */
  partial: string;
  error: string | null;
  start: () => Promise<void>;
  /** Stop and resolve with the captured text (finals + any trailing partial). */
  stop: () => Promise<string>;
}

export function useWordCapture(): UseWordCapture {
  const [state, setState] = useState<WordCaptureState>("idle");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<TranscriptionStream | null>(null);
  const captureRef = useRef<AudioCapture | null>(null);
  const finalsRef = useRef<string[]>([]);
  const partialRef = useRef("");

  const teardown = useCallback(async () => {
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
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setPartial("");
    finalsRef.current = [];
    partialRef.current = "";
    setState("recording");
    try {
      const stream = createDeepgramStream({ diarize: false });
      streamRef.current = stream;
      stream.on((e) => {
        if (e.kind === "final") {
          finalsRef.current.push(e.text);
          partialRef.current = "";
          setPartial("");
        } else if (e.kind === "partial") {
          partialRef.current = e.text;
          setPartial(e.text);
        } else if (e.kind === "error") {
          setError(e.error.message);
          setState("error");
        }
      });

      const capture = createAudioCapture();
      captureRef.current = capture;
      await capture.start((chunk) => stream.sendPcm(chunk));

      await stream.connect({
        getToken: async () => {
          const key = await mintScratchDeepgramKeyAction();
          if (!key.ok) throw new Error(key.error);
          return key.data.apiKey;
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
      await teardown();
    }
  }, [teardown]);

  const stop = useCallback(async (): Promise<string> => {
    await teardown();
    setState("idle");
    // Keep a trailing partial that never got finalised — a single word said
    // right before stop often arrives only as interim text.
    const text = [...finalsRef.current, partialRef.current]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    finalsRef.current = [];
    partialRef.current = "";
    setPartial("");
    return text;
  }, [teardown]);

  return { state, partial, error, start, stop };
}
