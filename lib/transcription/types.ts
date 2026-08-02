// Client-side transcription engine types. The engine streams audio to Deepgram
// directly from the browser and surfaces interim/final text as events.

export type TranscriptEvent =
  | { kind: "partial"; text: string; speaker?: number; ts: number }
  | { kind: "final"; text: string; speaker?: number; ts: number }
  // Deepgram's end-of-stream Metadata: the billable audio duration it
  // processed and its request id, surfaced for usage metering + reconciliation.
  | { kind: "metadata"; durationSeconds: number; requestId?: string }
  // `fatal` means the stream has given up — the session is over and the error
  // is the clinician's to act on. A non-fatal error is informational; the
  // client is still trying to recover.
  | { kind: "error"; error: Error; fatal: boolean }
  // The socket dropped and a reconnect is queued. Audio keeps being captured
  // and buffered throughout, so this is a warning, not a stop.
  | { kind: "reconnecting"; attempt: number; delayMs: number }
  // The socket is back and the buffered audio has been replayed.
  | { kind: "reconnected" }
  | { kind: "closed"; reason: string };

// Whether audio is currently reaching Deepgram. Distinct from the recorder's
// own state: a session can be "recording" while the connection is
// "reconnecting" — the mic is live and buffering, nothing is being transcribed
// yet.
export type ConnectionState = "idle" | "connecting" | "online" | "reconnecting";

export interface ConnectOptions {
  // Resolves an ephemeral Deepgram key (minted server-side per session).
  getToken: () => Promise<string>;
}

export interface TranscriptionStream {
  connect(opts: ConnectOptions): Promise<void>;
  sendPcm(chunk: Int16Array): void;
  close(): Promise<void>;
  on(listener: (e: TranscriptEvent) => void): () => void;
}
