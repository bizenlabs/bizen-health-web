import type {
  ConnectOptions,
  TranscriptEvent,
  TranscriptionStream,
} from "./types";
import {
  DEFAULT_TRANSCRIPTION_LANGUAGE,
  isEnglishTranscriptionLanguage,
  modelForTranscriptionLanguage,
} from "./languages";

// Browser → Deepgram streaming client. Deepgram's browser-auth pattern is a
// WebSocket subprotocol — `new WebSocket(url, ['token', <key>])` — not an HTTP
// header, so we keep our own transport rather than the @deepgram/sdk client.
//
// Ported from the med-scribe POC (lib/transcription/deepgram.ts); the POC's
// always-on `diarize` is now an option (encounter = on, dictation = off), and
// the SDK type dependency is replaced by the minimal inline shapes below.

const LISTEN_URL = "wss://api.deepgram.com/v1/listen";

// Cap the pending-audio buffer so it never grows unbounded if the WS never
// opens. 1500 frames × ~40 ms ≈ 60 s at 1.3 KB/frame ≈ 1.9 MB — sized for a
// reconnect gap (a lift, a tunnel, a cell handover), not just the handshake.
const MAX_PENDING_CHUNKS = 1500;
const KEEPALIVE_MS = 5000;
// A handshake that never settles — captive portal, half-open link — would
// otherwise leave connect() pending forever and the recorder stuck "starting".
const CONNECT_TIMEOUT_MS = 10_000;
const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 15_000;
// Bounds how long we chase a connection that isn't coming back. At the delays
// above this is roughly 90 s of retrying before the session is failed.
const MAX_RECONNECT_ATTEMPTS = 10;
// Ceiling on unsent bytes queued in the socket. Past this the uplink can't
// keep up with 32 KB/s of PCM, so further frames go to `pending` (which drops
// oldest-first) instead of inflating send latency without bound.
const MAX_BUFFERED_BYTES = 1_000_000;

// Close codes where reconnecting would fail identically — the request or the
// credentials are wrong, not the network. Deepgram signals auth and
// malformed-request failures with 1008, and protocol-level rejections with
// 1002/1003. Everything else (1006 abnormal, 1011 server error, the 4xxx
// application range) is treated as transient and retried; MAX_RECONNECT_
// ATTEMPTS bounds the cost of guessing wrong.
const NON_RETRYABLE_CLOSE_CODES = new Set([1002, 1003, 1008]);

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
// Deepgram emits a final Metadata message at end-of-stream carrying the audio
// duration it processed (billable seconds) and the request id.
type DeepgramMetadata = {
  type: "Metadata";
  duration?: number;
  request_id?: string;
};
type DeepgramMessage = DeepgramResults | DeepgramMetadata | { type: string };

export interface DeepgramStreamOptions {
  // Encounter transcriptions diarize (speaker 0/1/…); dictation does not.
  diarize: boolean;
  // The clinic's custom-dictionary spoken forms, fed to Deepgram as `keyterm`
  // prompts so accented or unusual terms (drug names, proper nouns) transcribe
  // correctly. Optional — omit for no custom vocabulary.
  keyterms?: string[];
  // The tenant's transcription language/accent (BCP-47). Optional — falls back
  // to DEFAULT_TRANSCRIPTION_LANGUAGE when the tenant hasn't set one.
  language?: string;
  // The clinician dictates punctuation themselves ("period", "comma", …), so
  // Deepgram's auto-punctuation must be off — otherwise both fire and the text
  // ends up double-punctuated. Default false (auto-punctuation on).
  spokenPunctuation?: boolean;
  // How hard to chase a dropped socket. Defaults to MAX_RECONNECT_ATTEMPTS,
  // which suits a long dictation. Pass 0 for one-shot captures (a single word,
  // a voice command) where the utterance is over in seconds and a retry loop
  // would read as a hang — there, the first drop should surface immediately.
  maxReconnectAttempts?: number;
}

// Deepgram caps key-term prompting at 500 tokens per request. We can't count
// tokens here, so approximate with words and stay well under: cap the count and
// a word budget. Excess terms are dropped (the dictionary list is ordered, so
// this is a stable prefix).
const MAX_KEYTERMS = 100;
const KEYTERM_WORD_BUDGET = 400;

function appendKeyterms(params: URLSearchParams, keyterms: string[]): void {
  let budget = KEYTERM_WORD_BUDGET;
  let count = 0;
  for (const raw of keyterms) {
    const term = raw.trim();
    if (!term) continue;
    if (count >= MAX_KEYTERMS) break;
    const words = term.split(/\s+/).length;
    if (budget - words < 0) break;
    // nova-3 takes `keyterm` (repeatable). URLSearchParams encodes each value.
    params.append("keyterm", term);
    budget -= words;
    count += 1;
  }
}

// Exported for unit testing of the param assembly.
export function buildListenUrl(
  diarize: boolean,
  keyterms: string[] = [],
  language: string = DEFAULT_TRANSCRIPTION_LANGUAGE,
  spokenPunctuation: boolean = false,
): string {
  const params = new URLSearchParams({
    // The model follows the language: English accents → nova-3-medical
    // (medical vocabulary), every other language → general nova-3.
    model: modelForTranscriptionLanguage(language),
    // Per-tenant language/accent. English variants (en-IN, en, …), the mixed
    // Hindi+English "multi" code-switching option, or a single non-English
    // language (hi, mr, bn, ta, te).
    language,
    interim_results: "true",
    // In spoken-punctuation mode auto-punctuation must not also fire, and
    // punctuation is part of smart_format — so the whole thing goes off.
    smart_format: spokenPunctuation ? "false" : "true",
    encoding: "linear16",
    sample_rate: "16000",
    channels: "1",
  });
  // Abbreviate spoken metric units ("centimeter" → "cm", "milligram" → "mg").
  // English-oriented, so only request it for English languages — other
  // languages don't support it.
  if (isEnglishTranscriptionLanguage(language)) {
    params.set("measurements", "true");
    // Losing smart_format also loses digit conversion; `numerals` restores
    // "one twenty" → "120" on its own. English-only, like measurements.
    if (spokenPunctuation) params.set("numerals", "true");
  }
  if (diarize) params.set("diarize", "true");
  if (keyterms.length > 0) appendKeyterms(params, keyterms);
  return `${LISTEN_URL}?${params.toString()}`;
}

export function createDeepgramStream(
  opts: DeepgramStreamOptions,
): TranscriptionStream {
  let ws: WebSocket | null = null;
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // Set by close(); tells the close handler this teardown was ours and must
  // not trigger a reconnect.
  let closing = false;
  // Consecutive failed reconnects. Reset on a successful open.
  let attempt = 0;
  // Held from connect() so a reconnect can re-mint a key — the ephemeral key
  // is per-request, and the old one may well have expired during the outage.
  let getTokenFn: (() => Promise<string>) | null = null;
  let onlineHandler: (() => void) | null = null;
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

  // True when the socket's send queue is already deeper than the link is
  // draining. Sending more would only add latency, so callers queue instead.
  function isBackedUp(): boolean {
    return (ws?.bufferedAmount ?? 0) > MAX_BUFFERED_BYTES;
  }

  // Queue a frame for later, dropping the oldest audio once the buffer is
  // full. Newest-first is the right policy: after a long gap the recent words
  // are the ones still worth transcribing.
  function queue(chunk: Int16Array): void {
    pending.push(chunk);
    if (pending.length > MAX_PENDING_CHUNKS) {
      pending.splice(0, pending.length - MAX_PENDING_CHUNKS);
    }
  }

  function flushPending(): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    while (pending.length > 0) {
      // Congested link — leave the rest queued rather than piling it into the
      // socket, and let the next sendPcm try again.
      if (isBackedUp()) return;
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
    if (msg.type === "Results") {
      handleResults(msg as DeepgramResults);
      return;
    }
    if (msg.type === "Metadata") {
      const meta = msg as DeepgramMetadata;
      emit({
        kind: "metadata",
        durationSeconds: meta.duration ?? 0,
        requestId: meta.request_id,
      });
      return;
    }
    // SpeechStarted / UtteranceEnd are ignored for now.
  }

  // Opens one socket and wires it up. Resolves once the handshake completes;
  // rejects on error or timeout without leaving a half-live socket behind.
  // Used for both the initial connect and every reconnect.
  async function openSocket(): Promise<void> {
    if (!getTokenFn) throw new Error("stream not connected");
    const token = await getTokenFn();
    const socket = new WebSocket(
      buildListenUrl(
        opts.diarize,
        opts.keyterms ?? [],
        opts.language,
        opts.spokenPunctuation ?? false,
      ),
      ["token", token],
    );
    socket.binaryType = "arraybuffer";

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        socket.onopen = null;
        socket.onerror = null;
        try {
          socket.close();
        } catch {
          /* already dead */
        }
        reject(new Error("deepgram connection timed out"));
      }, CONNECT_TIMEOUT_MS);
      socket.onopen = () => {
        clearTimeout(timer);
        resolve();
      };
      socket.onerror = () => {
        clearTimeout(timer);
        reject(new Error("deepgram socket error"));
      };
    });

    ws = socket;
    socket.onmessage = (ev) => {
      if (typeof ev.data === "string") handleMessage(ev.data);
    };
    // Post-handshake errors are not surfaced here: a WebSocket always fires
    // `close` after `error`, and handleClose is where the retry-or-fail
    // decision lives. Emitting from both would double-report every blip.
    socket.onerror = null;
    socket.onclose = handleClose;

    // Drain anything captured while the WS was opening (or during the outage
    // this reconnect just ended), then begin keepalives so the stream survives
    // any lull in speech.
    flushPending();
    startKeepalive();
  }

  function handleClose(ev: CloseEvent): void {
    stopKeepalive();
    ws = null;
    const reason = ev.reason || `code ${ev.code}`;
    if (closing) {
      emit({ kind: "closed", reason });
      return;
    }
    if (NON_RETRYABLE_CLOSE_CODES.has(ev.code)) {
      giveUp(`deepgram rejected the stream (${reason})`);
      return;
    }
    // Includes a clean 1000 we didn't ask for — Deepgram ending the stream on
    // its own while the clinician is still dictating is exactly the case a
    // reconnect exists to cover.
    scheduleReconnect(reason);
  }

  function giveUp(message: string): void {
    attempt = 0;
    emit({ kind: "error", error: new Error(message), fatal: true });
    emit({ kind: "closed", reason: message });
  }

  function scheduleReconnect(reason: string): void {
    if (closing) return;
    const maxAttempts = opts.maxReconnectAttempts ?? MAX_RECONNECT_ATTEMPTS;
    if (attempt >= maxAttempts) {
      giveUp(`lost connection to Deepgram (${reason})`);
      return;
    }
    attempt += 1;
    const backoff = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** (attempt - 1),
    );
    // Jitter so a clinic full of devices coming back on one flaky uplink
    // doesn't retry in lockstep.
    const delayMs = Math.round(backoff * (0.75 + Math.random() * 0.5));
    emit({ kind: "reconnecting", attempt, delayMs });
    reconnectTimer = setTimeout(() => void attemptReconnect(), delayMs);
  }

  async function attemptReconnect(): Promise<void> {
    reconnectTimer = null;
    if (closing || ws) return;
    try {
      await openSocket();
      attempt = 0;
      emit({ kind: "reconnected" });
    } catch (err) {
      if (closing) return;
      scheduleReconnect(err instanceof Error ? err.message : String(err));
    }
  }

  // The OS says the network is back. Collapse whatever backoff is left and
  // retry immediately — waiting out a 15 s timer when connectivity has
  // demonstrably returned just extends the gap. The attempt counter resets
  // because this is a real state change, not another blind retry.
  function handleOnline(): void {
    if (closing || ws || !reconnectTimer) return;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    attempt = 0;
    void attemptReconnect();
  }

  return {
    async connect({ getToken }: ConnectOptions) {
      closing = false;
      attempt = 0;
      getTokenFn = getToken;
      // Let a first-connect failure propagate: start() turns it into a visible
      // error rather than a silent retry loop before anything is recording.
      await openSocket();
      if (typeof window !== "undefined") {
        onlineHandler = handleOnline;
        window.addEventListener("online", onlineHandler);
      }
    },

    sendPcm(chunk) {
      if (ws?.readyState === WebSocket.OPEN && !isBackedUp()) {
        if (pending.length > 0) {
          flushPending();
          // flushPending may have stopped on backpressure. Queue behind what's
          // left rather than jumping the line and delivering audio out of
          // order.
          if (pending.length > 0) {
            queue(chunk);
            return;
          }
        }
        ws.send(chunk.buffer);
        return;
      }
      // Socket opening, reconnecting, or congested. Buffer so the words spoken
      // across the gap survive to be replayed.
      queue(chunk);
    },

    async close() {
      // Set first: ws.close() below fires handleClose, which must read this as
      // a deliberate teardown and not queue a reconnect.
      closing = true;
      stopKeepalive();
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (onlineHandler && typeof window !== "undefined") {
        window.removeEventListener("online", onlineHandler);
        onlineHandler = null;
      }
      getTokenFn = null;
      if (!ws) {
        // Closed mid-outage. Whatever is still buffered has nowhere to go —
        // Deepgram is the only thing that could transcribe it.
        pending.length = 0;
        return;
      }
      try {
        // Hand over any buffered audio before signalling end-of-stream; the
        // browser drains the send queue before the socket actually closes.
        flushPending();
        sendControl("CloseStream");
      } finally {
        pending.length = 0;
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
