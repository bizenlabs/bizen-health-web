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
  /**
   * Live text while recording — finalised utterances so far plus the current
   * interim. Show it so the user sees words appear as they speak, not only
   * after stopping.
   */
  preview: string;
  error: string | null;
  start: () => Promise<void>;
  /** Stop and resolve with the captured text (finals + any trailing partial). */
  stop: () => Promise<string>;
}

function composeText(finals: string[], partial: string): string {
  return [...finals, partial].join(" ").replace(/\s+/g, " ").trim();
}

export function useWordCapture(): UseWordCapture {
  const [state, setState] = useState<WordCaptureState>("idle");
  const [preview, setPreview] = useState("");
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
    setPreview("");
    finalsRef.current = [];
    partialRef.current = "";
    setState("recording");
    try {
      // One word, a couple of seconds — a dropped socket is better surfaced
      // straight away than chased through a retry loop.
      const stream = createDeepgramStream({
        diarize: false,
        maxReconnectAttempts: 0,
      });
      streamRef.current = stream;
      stream.on((e) => {
        if (e.kind === "final") {
          finalsRef.current.push(e.text);
          partialRef.current = "";
          setPreview(composeText(finalsRef.current, ""));
        } else if (e.kind === "partial") {
          partialRef.current = e.text;
          setPreview(composeText(finalsRef.current, e.text));
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
    const text = composeText(finalsRef.current, partialRef.current);
    finalsRef.current = [];
    partialRef.current = "";
    setPreview("");
    return text;
  }, [teardown]);

  return { state, preview, error, start, stop };
}
