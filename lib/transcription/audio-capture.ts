import { WORKLET_SOURCE } from "./worklet-processor";

// Microphone capture: getUserMedia → 16 kHz AudioContext → AudioWorklet that
// downsamples to Int16 PCM. Browser-only; never imported on the server.
//
// Ported from the med-scribe POC (lib/audio/capture.ts).

export interface AudioCapture {
  start(onChunk: (pcm: Int16Array) => void): Promise<void>;
  // Mutes the mic track (OS indicator goes dark) and gates the PCM callback
  // so no chunks are forwarded while paused. The AudioContext + worklet stay
  // running so resume() is instant.
  pause(): void;
  resume(): void;
  stop(): Promise<void>;
  listDevices(): Promise<MediaDeviceInfo[]>;
}

// Acquire the mic stream, pinning the requested device when one is given. The
// pinned device may be gone — unplugged, or simply absent on the machine where
// a dictation is resumed — in which case `getUserMedia` rejects with
// OverconstrainedError (or NotFoundError). Fall back to the browser's default
// mic so recording still starts rather than dead-ending; the editor's mic
// picker lets the clinician switch afterwards. Permission denials (NotAllowed)
// are not recoverable this way and propagate unchanged.
async function acquireStream(deviceId?: string): Promise<MediaStream> {
  const base: MediaTrackConstraints = {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { ...base, deviceId: { exact: deviceId } } : base,
    });
  } catch (err) {
    // OverconstrainedError isn't an Error instance in every browser — read the
    // name off the object directly rather than gating on `instanceof Error`.
    const name =
      typeof err === "object" && err !== null && "name" in err
        ? String((err as { name: unknown }).name)
        : "";
    if (
      deviceId &&
      (name === "OverconstrainedError" || name === "NotFoundError")
    ) {
      return await navigator.mediaDevices.getUserMedia({ audio: base });
    }
    throw err;
  }
}

export function createAudioCapture(deviceId?: string): AudioCapture {
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let node: AudioWorkletNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let blobUrl: string | null = null;
  let paused = false;

  return {
    async start(onChunk) {
      stream = await acquireStream(deviceId);

      // Request a 16 kHz AudioContext; browsers that can't honor it resample
      // transparently and the worklet normalizes the rest.
      ctx = new AudioContext({ sampleRate: 16000 });
      if (ctx.state === "suspended") await ctx.resume();

      const blob = new Blob([WORKLET_SOURCE], {
        type: "application/javascript",
      });
      blobUrl = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(blobUrl);

      source = ctx.createMediaStreamSource(stream);
      node = new AudioWorkletNode(ctx, "pcm-downsampler", {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
      });
      node.port.onmessage = (ev: MessageEvent<Int16Array>) => {
        if (paused) return;
        onChunk(ev.data);
      };
      source.connect(node);
    },

    pause() {
      paused = true;
      stream?.getAudioTracks().forEach((t) => {
        t.enabled = false;
      });
    },

    resume() {
      stream?.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });
      paused = false;
    },

    async stop() {
      try {
        node?.port.close();
        node?.disconnect();
        source?.disconnect();
        stream?.getTracks().forEach((t) => t.stop());
        await ctx?.close();
      } finally {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        stream = null;
        ctx = null;
        node = null;
        source = null;
        blobUrl = null;
      }
    },

    async listDevices() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "audioinput");
    },
  };
}
