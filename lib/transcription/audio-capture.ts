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
  // Current input loudness in [0, 1], a smoothed RMS of the most recent PCM
  // frames. Drives the live level meter so the clinician can see the mic is
  // actually picking up audio. Returns 0 before capture starts and decays to 0
  // while paused (the worklet keeps emitting silent frames).
  getLevel(): number;
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
  // Smoothed input loudness, updated on every PCM frame. Fast attack so a word
  // lights the meter instantly, slower decay so it falls back like a real VU.
  let level = 0;

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
        // Update the meter from every frame — including while paused, where the
        // muted track yields silence so the level naturally falls to 0.
        const pcm = ev.data;
        let sumSquares = 0;
        for (let i = 0; i < pcm.length; i++) {
          const sample = pcm[i] / 0x8000;
          sumSquares += sample * sample;
        }
        const rms = pcm.length > 0 ? Math.sqrt(sumSquares / pcm.length) : 0;
        level = rms > level ? rms : level * 0.8 + rms * 0.2;

        if (paused) return;
        onChunk(pcm);
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
        level = 0;
      }
    },

    getLevel() {
      return level;
    },

    async listDevices() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "audioinput");
    },
  };
}
