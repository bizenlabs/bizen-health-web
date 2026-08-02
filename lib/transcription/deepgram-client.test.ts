import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildListenUrl, createDeepgramStream } from "./deepgram-client";
import {
  modelForTranscriptionLanguage,
  isSupportedTranscriptionLanguage,
} from "./languages";
import type { TranscriptEvent } from "./types";

function paramsOf(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe("modelForTranscriptionLanguage", () => {
  it("keeps the medical model for English variants", () => {
    for (const code of ["en-IN", "en", "en-US", "en-GB", "en-AU"]) {
      expect(modelForTranscriptionLanguage(code)).toBe("nova-3-medical");
    }
  });

  it("uses the general model for non-English languages", () => {
    for (const code of ["hi", "mr", "bn", "ta", "te", "multi"]) {
      expect(modelForTranscriptionLanguage(code)).toBe("nova-3");
    }
  });

  it("falls back to the medical model for unknown codes", () => {
    expect(modelForTranscriptionLanguage("xx")).toBe("nova-3-medical");
  });
});

describe("buildListenUrl", () => {
  it("defaults to Indian-accent English on the medical model", () => {
    const p = paramsOf(buildListenUrl(false));
    expect(p.get("model")).toBe("nova-3-medical");
    expect(p.get("language")).toBe("en-IN");
  });

  it("switches to the general model for a non-English language", () => {
    const p = paramsOf(buildListenUrl(false, [], "hi"));
    expect(p.get("model")).toBe("nova-3");
    expect(p.get("language")).toBe("hi");
  });

  it("selects multi + general model for mixed Hindi/English", () => {
    const p = paramsOf(buildListenUrl(false, [], "multi"));
    expect(p.get("model")).toBe("nova-3");
    expect(p.get("language")).toBe("multi");
  });

  it("requests measurements only for English languages", () => {
    expect(
      paramsOf(buildListenUrl(false, [], "en-IN")).get("measurements"),
    ).toBe("true");
    expect(
      paramsOf(buildListenUrl(false, [], "hi")).get("measurements"),
    ).toBeNull();
    expect(
      paramsOf(buildListenUrl(false, [], "multi")).get("measurements"),
    ).toBeNull();
  });

  it("keeps smart_format on by default", () => {
    expect(paramsOf(buildListenUrl(false)).get("smart_format")).toBe("true");
    expect(paramsOf(buildListenUrl(false)).get("numerals")).toBeNull();
  });

  it("turns auto-punctuation off in spoken-punctuation mode", () => {
    const p = paramsOf(buildListenUrl(false, [], "en-IN", true));
    expect(p.get("smart_format")).toBe("false");
    // Digit conversion survives losing smart_format via `numerals`.
    expect(p.get("numerals")).toBe("true");
  });

  it("omits numerals for non-English spoken-punctuation streams", () => {
    const p = paramsOf(buildListenUrl(false, [], "hi", true));
    expect(p.get("smart_format")).toBe("false");
    expect(p.get("numerals")).toBeNull();
  });

  it("adds diarize only when requested and always passes keyterms", () => {
    const p = paramsOf(buildListenUrl(true, ["ibuprofen", "amlodipine"], "hi"));
    expect(p.get("diarize")).toBe("true");
    expect(p.getAll("keyterm")).toEqual(["ibuprofen", "amlodipine"]);
  });

  it("only lists languages Deepgram supports in streaming", () => {
    // Guard against re-introducing an unsupported code into the picker.
    expect(isSupportedTranscriptionLanguage("hi")).toBe(true);
    expect(isSupportedTranscriptionLanguage("ml")).toBe(false); // Malayalam: not supported
  });
});

// --- Reconnect / resilience -------------------------------------------------
//
// The socket layer is what stands between a clinician on a flaky clinic uplink
// and a silently truncated consultation note, so its recovery behaviour is
// pinned here rather than left to manual testing. A fake WebSocket stands in
// for the real one; timers are faked so backoff is asserted exactly.

type CloseInfo = { code: number; reason: string };

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;
  bufferedAmount = 0;
  binaryType = "";
  sent: Array<string | ArrayBuffer> = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onclose: ((ev: CloseInfo) => void) | null = null;

  constructor(
    readonly url: string,
    readonly protocols?: string | string[],
  ) {
    FakeWebSocket.instances.push(this);
  }

  send(data: string | ArrayBuffer): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED;
  }

  // --- test drivers ---
  accept(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }

  // The server (or the network) dropping the connection.
  drop(code = 1006, reason = ""): void {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.({ code, reason });
  }

  fail(): void {
    this.onerror?.();
  }

  // Audio frames only — keepalive control frames are JSON strings.
  get audioFrames(): ArrayBuffer[] {
    return this.sent.filter((d): d is ArrayBuffer => typeof d !== "string");
  }
}

// Lets the pending async chain inside connect()/attemptReconnect() progress to
// its next await without advancing fake timers.
async function settle(turns = 8): Promise<void> {
  for (let i = 0; i < turns; i++) await Promise.resolve();
}

// Opens a stream and accepts the handshake, returning the collected events.
async function connected(
  opts: Parameters<typeof createDeepgramStream>[0] = { diarize: false },
  getToken: () => Promise<string> = async () => "key-1",
) {
  const stream = createDeepgramStream(opts);
  const events: TranscriptEvent[] = [];
  stream.on((e) => events.push(e));
  const connecting = stream.connect({ getToken });
  await settle();
  FakeWebSocket.instances[0].accept();
  await connecting;
  return { stream, events };
}

function frame(value = 1): Int16Array {
  return new Int16Array([value, value, value]);
}

describe("createDeepgramStream — connection resilience", () => {
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket);
    // Pin jitter to its midpoint so backoff delays are exact.
    randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
  });

  afterEach(() => {
    randomSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reconnects with a fresh key after an unexpected drop", async () => {
    const tokens = ["key-1", "key-2"];
    let minted = 0;
    const { events } = await connected({ diarize: false }, async () => {
      return tokens[minted++];
    });

    FakeWebSocket.instances[0].drop(1006, "network");
    expect(events.at(-1)).toMatchObject({ kind: "reconnecting", attempt: 1 });
    // Nothing reconnects before the backoff elapses.
    expect(FakeWebSocket.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(500);
    expect(FakeWebSocket.instances).toHaveLength(2);
    FakeWebSocket.instances[1].accept();
    await settle();

    expect(events.at(-1)).toEqual({ kind: "reconnected" });
    // The ephemeral key is re-minted — the old one may have expired during the
    // outage.
    expect(minted).toBe(2);
    expect(FakeWebSocket.instances[1].protocols).toEqual(["token", "key-2"]);
  });

  it("replays audio captured during the outage once reconnected", async () => {
    const { stream } = await connected();
    const first = FakeWebSocket.instances[0];
    stream.sendPcm(frame(1));
    expect(first.audioFrames).toHaveLength(1);

    first.drop();
    // Spoken while the socket was down — must be buffered, not dropped.
    stream.sendPcm(frame(2));
    stream.sendPcm(frame(3));

    await vi.advanceTimersByTimeAsync(500);
    const second = FakeWebSocket.instances[1];
    second.accept();
    await settle();

    expect(second.audioFrames).toHaveLength(2);
  });

  it("backs off exponentially and gives up after the attempt cap", async () => {
    const { events } = await connected({
      diarize: false,
      maxReconnectAttempts: 3,
    });
    FakeWebSocket.instances[0].drop();

    // Each retry is refused mid-handshake, so the backoff doubles: 500ms,
    // 1000ms, 2000ms. A retry that fails to connect must itself be retried —
    // an outage rarely clears on the first attempt.
    for (const [attempt, delay] of [
      [1, 500],
      [2, 1000],
      [3, 2000],
    ]) {
      expect(events.at(-1)).toMatchObject({ kind: "reconnecting", attempt });
      await vi.advanceTimersByTimeAsync(delay);
      FakeWebSocket.instances.at(-1)!.fail();
      await settle();
    }

    // Cap reached — the session is failed rather than retried forever.
    const fatal = events.find((e) => e.kind === "error");
    expect(fatal).toMatchObject({ kind: "error", fatal: true });
    expect(events.at(-1)?.kind).toBe("closed");
    expect(FakeWebSocket.instances).toHaveLength(4);
  });

  it("does not retry a close code that says the request itself is wrong", async () => {
    const { events } = await connected();
    // 1008 policy violation — Deepgram's signal for auth/permission failure.
    FakeWebSocket.instances[0].drop(1008, "invalid credentials");

    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(events.some((e) => e.kind === "reconnecting")).toBe(false);
    expect(events.find((e) => e.kind === "error")).toMatchObject({
      fatal: true,
    });
  });

  it("surfaces a drop immediately when reconnect is disabled", async () => {
    const { events } = await connected({
      diarize: false,
      maxReconnectAttempts: 0,
    });
    FakeWebSocket.instances[0].drop();

    expect(events.some((e) => e.kind === "reconnecting")).toBe(false);
    expect(events.find((e) => e.kind === "error")).toMatchObject({
      fatal: true,
    });
  });

  it("never reconnects after a deliberate close", async () => {
    const { stream, events } = await connected();
    await stream.close();
    // close() nulls the socket, so drive the close callback as the browser
    // would after ws.close().
    FakeWebSocket.instances[0].drop(1000, "");

    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(events.some((e) => e.kind === "reconnecting")).toBe(false);
  });

  it("reconnects on a clean close it did not ask for", async () => {
    const { events } = await connected();
    // Deepgram ending the stream itself while the clinician is still talking.
    FakeWebSocket.instances[0].drop(1000, "");

    expect(events.at(-1)).toMatchObject({ kind: "reconnecting" });
    await vi.advanceTimersByTimeAsync(500);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });

  it("rejects a handshake that never settles", async () => {
    const stream = createDeepgramStream({ diarize: false });
    const connecting = stream.connect({ getToken: async () => "key-1" });
    const assertion = expect(connecting).rejects.toThrow(/timed out/);
    await settle();
    // Socket never accepts — without the timeout this would hang start()
    // forever and leave the recorder stuck on "starting".
    await vi.advanceTimersByTimeAsync(10_000);
    await assertion;
  });

  it("queues rather than sends while the socket is backed up", async () => {
    const { stream } = await connected();
    const socket = FakeWebSocket.instances[0];
    // Uplink can't drain: the send queue is already past the ceiling.
    socket.bufferedAmount = 2_000_000;
    stream.sendPcm(frame());
    expect(socket.audioFrames).toHaveLength(0);

    // Queue drains; the buffered frame goes out with the next one.
    socket.bufferedAmount = 0;
    stream.sendPcm(frame());
    expect(socket.audioFrames).toHaveLength(2);
  });

  it("keeps the newest audio when an outage outlasts the buffer", async () => {
    const { stream } = await connected();
    FakeWebSocket.instances[0].drop();
    // 1600 frames against a 1500-frame cap.
    for (let i = 0; i < 1600; i++) stream.sendPcm(frame(i));

    await vi.advanceTimersByTimeAsync(500);
    const second = FakeWebSocket.instances[1];
    second.accept();
    await settle();

    expect(second.audioFrames).toHaveLength(1500);
    // Oldest-first is what got dropped: frame 100 is the first survivor.
    expect(new Int16Array(second.audioFrames[0])[0]).toBe(100);
  });

  it("retries immediately when the OS reports the network is back", async () => {
    const listeners = new Map<string, Array<() => void>>();
    vi.stubGlobal("window", {
      addEventListener: (type: string, fn: () => void) => {
        listeners.set(type, [...(listeners.get(type) ?? []), fn]);
      },
      removeEventListener: (type: string, fn: () => void) => {
        listeners.set(
          type,
          (listeners.get(type) ?? []).filter((f) => f !== fn),
        );
      },
    });

    const { stream } = await connected();
    FakeWebSocket.instances[0].drop();
    expect(FakeWebSocket.instances).toHaveLength(1);

    // Connectivity returns well before the backoff timer would have fired —
    // waiting it out would only extend the gap.
    listeners.get("online")!.forEach((fn) => fn());
    await settle();
    expect(FakeWebSocket.instances).toHaveLength(2);

    // And the listener is released on teardown rather than leaking per session.
    await stream.close();
    expect(listeners.get("online")).toHaveLength(0);
  });
});
