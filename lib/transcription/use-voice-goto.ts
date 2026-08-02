"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mintScratchDeepgramKeyAction } from "@/app/(app)/transcription-actions";
import { type AudioCapture, createAudioCapture } from "./audio-capture";
import { createDeepgramStream } from "./deepgram-client";
import { parseGotoLine } from "./goto-line-command";
import type { TranscriptionStream } from "./types";

// One-shot "go to line X" voice navigation for the template editor. Reuses the
// same session-less mic + Deepgram pipeline as the dictionary "record a word"
// affordance (useWordCapture): it mints an ephemeral scratch key, so there is
// NO transcription record and NO billed session — it's a throwaway listen.
//
// Unlike useWordCapture (which accumulates and returns text on stop), this fires
// on each *finalised* utterance: the first one that parses to a line number
// invokes onLine and the mic stops. If nothing matches within LISTEN_TIMEOUT_MS
// it stops on its own so the mic never stays open indefinitely.

export type VoiceGotoState = "idle" | "listening" | "error";

const LISTEN_TIMEOUT_MS = 8000;

export interface UseVoiceGoto {
  state: VoiceGotoState;
  /** Live interim text while listening — shown so the user sees it working. */
  partial: string;
  error: string | null;
  /** Start listening if idle, stop if already listening. */
  toggle: () => void;
  stop: () => void;
}

export function useVoiceGoto(onLine: (line: number) => void): UseVoiceGoto {
  const [state, setState] = useState<VoiceGotoState>("idle");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<TranscriptionStream | null>(null);
  const captureRef = useRef<AudioCapture | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the latest callback without re-subscribing the stream listener.
  const onLineRef = useRef(onLine);
  useEffect(() => {
    onLineRef.current = onLine;
  }, [onLine]);

  const teardown = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
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

  const stop = useCallback(() => {
    void teardown();
    setPartial("");
    setState((s) => (s === "error" ? s : "idle"));
  }, [teardown]);

  const start = useCallback(async () => {
    setError(null);
    setPartial("");
    setState("listening");
    try {
      // A single spoken command — surface a dropped socket immediately rather
      // than retrying past the moment the command was useful.
      const stream = createDeepgramStream({
        diarize: false,
        maxReconnectAttempts: 0,
      });
      streamRef.current = stream;
      stream.on((e) => {
        if (e.kind === "final") {
          const line = parseGotoLine(e.text);
          if (line !== null) {
            onLineRef.current(line);
            stop();
          } else {
            // Not a command — clear the interim and keep listening for a retry.
            setPartial("");
          }
        } else if (e.kind === "partial") {
          setPartial(e.text);
        } else if (e.kind === "error") {
          setError(e.error.message);
          setState("error");
          void teardown();
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

      // Don't leave the mic open forever if no command is spoken.
      timerRef.current = setTimeout(() => stop(), LISTEN_TIMEOUT_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("error");
      await teardown();
    }
  }, [stop, teardown]);

  const toggle = useCallback(() => {
    if (state === "listening") stop();
    else void start();
  }, [state, start, stop]);

  // Ensure the mic + socket are released if the editor unmounts mid-listen.
  useEffect(() => {
    return () => void teardown();
  }, [teardown]);

  return { state, partial, error, toggle, stop };
}
