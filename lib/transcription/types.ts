// Client-side transcription engine types. The engine streams audio to Deepgram
// directly from the browser and surfaces interim/final text as events.

export type TranscriptEvent =
  | { kind: "partial"; text: string; speaker?: number; ts: number }
  | { kind: "final"; text: string; speaker?: number; ts: number }
  | { kind: "error"; error: Error }
  | { kind: "closed"; reason: string };

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
