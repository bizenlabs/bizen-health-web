import type {
  ConnectOptions,
  TranscriptEvent,
  TranscriptionStream,
} from "./types";

// Browser → Deepgram streaming client. Deepgram's browser-auth pattern is a
// WebSocket subprotocol — `new WebSocket(url, ['token', <key>])` — not an HTTP
// header, so we keep our own transport rather than the @deepgram/sdk client.
//
// Ported from the med-scribe POC (lib/transcription/deepgram.ts); the POC's
// always-on `diarize` is now an option (encounter = on, dictation = off), and
// the SDK type dependency is replaced by the minimal inline shapes below.

const LISTEN_URL = "wss://api.deepgram.com/v1/listen";

// Cap the pending-audio buffer so it never grows unbounded if the WS never
// opens. 500 frames × ~40 ms ≈ 20 s — plenty for a slow handshake.
const MAX_PENDING_CHUNKS = 500;
const KEEPALIVE_MS = 5000;

type DeepgramWord = {
  word: string;
  punctuated_word?: string;
  speaker?: number;
};
type DeepgramAlternative = { transcript: string; words?: DeepgramWord[] };
type DeepgramResults = {
  type: "Results";
  is_final: boolean;
  channel: { alternatives: DeepgramAlternative[] };
};
type DeepgramMessage = DeepgramResults | { type: string };

export interface DeepgramStreamOptions {
  // Encounter transcriptions diarize (speaker 0/1/…); dictation does not.
  diarize: boolean;
}

function buildListenUrl(diarize: boolean): string {
  const params = new URLSearchParams({
    model: "nova-3-medical",
    interim_results: "true",
    smart_format: "true",
    encoding: "linear16",
    sample_rate: "16000",
    channels: "1",
  });
  if (diarize) params.set("diarize", "true");
  return `${LISTEN_URL}?${params.toString()}`;
}

export function createDeepgramStream(
  opts: DeepgramStreamOptions,
): TranscriptionStream {
  let ws: WebSocket | null = null;
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  const pending: Int16Array[] = [];
  const listeners = new Set<(e: TranscriptEvent) => void>();
  const emit = (e: TranscriptEvent) => listeners.forEach((l) => l(e));

  function sendControl(type: "KeepAlive" | "CloseStream"): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type }));
    }
  }

  function stopKeepalive(): void {
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
  }

  function startKeepalive(): void {
    stopKeepalive();
    keepaliveTimer = setInterval(() => sendControl("KeepAlive"), KEEPALIVE_MS);
  }

  function flushPending(): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    while (pending.length > 0) {
      const chunk = pending.shift()!;
      ws.send(chunk.buffer);
    }
  }

  function handleResults(msg: DeepgramResults): void {
    const alt = msg.channel.alternatives[0];
    if (!alt || !alt.transcript) return;

    const words = alt.words ?? [];
    if (words.length === 0) {
      emit({
        kind: msg.is_final ? "final" : "partial",
        text: alt.transcript,
        ts: Date.now(),
      });
      return;
    }

    if (msg.is_final) {
      // Split into consecutive same-speaker spans so a speaker swap
      // mid-segment surfaces as separate utterances.
      let spanStart = 0;
      for (let i = 1; i <= words.length; i++) {
        const prev = words[i - 1].speaker;
        const curr = i < words.length ? words[i].speaker : undefined;
        if (i === words.length || curr !== prev) {
          const text = words
            .slice(spanStart, i)
            .map((w) => w.punctuated_word ?? w.word)
            .join(" ")
            .trim();
          if (text) {
            emit({ kind: "final", text, speaker: prev, ts: Date.now() });
          }
          spanStart = i;
        }
      }
      return;
    }

    // Partials: emit one event tagged with the dominant speaker.
    const speakerCounts = new Map<number | undefined, number>();
    for (const w of words) {
      speakerCounts.set(w.speaker, (speakerCounts.get(w.speaker) ?? 0) + 1);
    }
    let top: number | undefined;
    let best = -1;
    for (const [sp, count] of speakerCounts) {
      if (count > best) {
        best = count;
        top = sp;
      }
    }
    emit({
      kind: "partial",
      text: alt.transcript,
      speaker: top,
      ts: Date.now(),
    });
  }

  function handleMessage(data: string): void {
    let msg: DeepgramMessage;
    try {
      msg = JSON.parse(data) as DeepgramMessage;
    } catch {
      return;
    }
    if (msg.type === "Results") handleResults(msg as DeepgramResults);
    // Metadata / SpeechStarted / UtteranceEnd are ignored for now.
  }

  return {
    async connect({ getToken }: ConnectOptions) {
      const token = await getToken();
      ws = new WebSocket(buildListenUrl(opts.diarize), ["token", token]);
      ws.binaryType = "arraybuffer";

      await new Promise<void>((resolve, reject) => {
        if (!ws) return reject(new Error("socket not created"));
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error("deepgram socket error"));
      });

      ws.onmessage = (ev) => {
        if (typeof ev.data === "string") handleMessage(ev.data);
      };
      ws.onerror = () => {
        emit({ kind: "error", error: new Error("deepgram socket error") });
      };
      ws.onclose = (ev) => {
        stopKeepalive();
        emit({ kind: "closed", reason: ev.reason || `code ${ev.code}` });
        ws = null;
      };

      // Drain anything captured while the WS was opening, then begin
      // keepalives so the stream survives any lull in speech.
      flushPending();
      startKeepalive();
    },

    sendPcm(chunk) {
      if (ws?.readyState === WebSocket.OPEN) {
        if (pending.length > 0) flushPending();
        ws.send(chunk.buffer);
        return;
      }
      // WS still opening (or momentarily closed). Buffer so the first words
      // aren't lost to the handshake window.
      pending.push(chunk);
      if (pending.length > MAX_PENDING_CHUNKS) {
        pending.splice(0, pending.length - MAX_PENDING_CHUNKS);
      }
    },

    async close() {
      stopKeepalive();
      if (!ws) return;
      try {
        sendControl("CloseStream");
      } finally {
        ws.close();
        ws = null;
      }
    },

    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
