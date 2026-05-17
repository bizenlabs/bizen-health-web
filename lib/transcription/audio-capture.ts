import { WORKLET_SOURCE } from "./worklet-processor";

// Microphone capture: getUserMedia → 16 kHz AudioContext → AudioWorklet that
// downsamples to Int16 PCM. Browser-only; never imported on the server.
//
// Ported from the med-scribe POC (lib/audio/capture.ts).

export interface AudioCapture {
  start(onChunk: (pcm: Int16Array) => void): Promise<void>;
  stop(): Promise<void>;
  listDevices(): Promise<MediaDeviceInfo[]>;
}

export function createAudioCapture(deviceId?: string): AudioCapture {
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let node: AudioWorkletNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let blobUrl: string | null = null;

  return {
    async start(onChunk) {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

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
        onChunk(ev.data);
      };
      source.connect(node);
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
