import { WORKLET_SOURCE } from "./worklet-processor";

// Microphone capture: getUserMedia → AudioContext at the device's native rate
// → anti-alias filter → AudioWorklet that downsamples to 16 kHz Int16 PCM.
// Browser-only; never imported on the server.

// What Deepgram is told to expect, and what the worklet converts down to.
const TARGET_SAMPLE_RATE = 16000;

// Anti-alias corner, comfortably below the 8 kHz Nyquist of the 16 kHz target
// while leaving the speech band (including sibilance, which carries a lot of
// the consonant detail Deepgram needs) intact.
const ANTI_ALIAS_HZ = 7000;
// Cascaded one-pole-pair sections; three gives roughly -45 dB at 16 kHz, so
// content that would fold back into the speech band is gone before decimation.
const ANTI_ALIAS_STAGES = 3;
// Web Audio expresses a lowpass Q in decibels, not as a bare quality factor.
// -3.01 dB is a linear Q of 0.707 — maximally flat, no resonant peak at the
// corner, which is what a filter cascade wants.
const LOWPASS_Q_DB = -3.01;

// Platform DSP applied to the microphone before the audio reaches us.
export interface AudioCaptureOptions {
  // Defaults to FALSE, unlike the browser default. None of these flows play
  // audio while recording, so there is no far-end signal for an echo canceller
  // to cancel — but asking for one still pulls mobile capture into the
  // platform's voice-communication path, which is tuned for phone calls
  // (narrowband, aggressive gating) rather than dictation. Set true only if a
  // flow starts playing audio while the mic is live.
  echoCancellation?: boolean;
  // The platform's own noise cancellation. On by default — for a clinic room
  // this is the single most useful piece of processing available, and it is
  // far better than anything we could run in JS.
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

// What the pipeline actually negotiated, for diagnosing device-specific audio
// problems. The context rate in particular varies by platform and is the first
// thing worth checking when transcription quality differs between devices.
export interface AudioDiagnostics {
  contextSampleRate: number | null;
  // Whether the anti-alias cascade is in the graph. False when the context
  // already runs at the target rate and there is nothing to filter.
  antiAliased: boolean;
  // The constraints the browser actually applied, which frequently differ from
  // the ones requested.
  trackSettings: MediaTrackSettings | null;
}

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
  // Whether the mic track is muted *at the source* — the OS or hardware is
  // withholding audio (e.g. a closed laptop lid mutes the internal mic). This
  // is distinct from pause(), which disables the track at the app level; a
  // source-muted track yields silence while still "live", so the meter reads 0
  // with no obvious cause. Returns false before capture starts.
  isMuted(): boolean;
  // What the pipeline negotiated on this device. Read it when transcription
  // quality is bad on one platform and fine on another.
  getDiagnostics(): AudioDiagnostics;
}

// Acquire the mic stream, pinning the requested device when one is given. The
// pinned device may be gone — unplugged, or simply absent on the machine where
// a dictation is resumed — in which case `getUserMedia` rejects with
// OverconstrainedError (or NotFoundError). Fall back to the browser's default
// mic so recording still starts rather than dead-ending; the editor's mic
// picker lets the clinician switch afterwards. Permission denials (NotAllowed)
// are not recoverable this way and propagate unchanged.
async function acquireStream(
  deviceId?: string,
  opts: AudioCaptureOptions = {},
): Promise<MediaStream> {
  const base: MediaTrackConstraints = {
    channelCount: 1,
    echoCancellation: opts.echoCancellation ?? false,
    noiseSuppression: opts.noiseSuppression ?? true,
    autoGainControl: opts.autoGainControl ?? true,
  };
  // Apple's on-device voice isolation, where the browser advertises it. Gated
  // on getSupportedConstraints rather than set blindly: it is not in every
  // engine, and an unrecognised key in an `exact` position would over-constrain
  // the request into failing.
  const supported = navigator.mediaDevices.getSupportedConstraints() as
    | (MediaTrackSupportedConstraints & { voiceIsolation?: boolean })
    | undefined;
  if (supported?.voiceIsolation) {
    (
      base as MediaTrackConstraints & { voiceIsolation?: boolean }
    ).voiceIsolation = true;
  }
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

export function createAudioCapture(
  deviceId?: string,
  options: AudioCaptureOptions = {},
): AudioCapture {
  let stream: MediaStream | null = null;
  let ctx: AudioContext | null = null;
  let node: AudioWorkletNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let filters: BiquadFilterNode[] = [];
  let blobUrl: string | null = null;
  let paused = false;
  // Smoothed input loudness, updated on every PCM frame. Fast attack so a word
  // lights the meter instantly, slower decay so it falls back like a real VU.
  let level = 0;

  return {
    async start(onChunk) {
      stream = await acquireStream(deviceId, options);

      // Run at the device's native rate. Asking for a 16 kHz context instead
      // looks tidier — the worklet ratio becomes 1 and the browser resamples
      // for us — but a MediaStream source feeding a context whose rate differs
      // from the hardware rate is badly handled on mobile Safari, and the
      // failure is silent: audio arrives distorted rather than absent, so it
      // reads as "transcription is just worse on phones". The worklet converts
      // from whatever rate this turns out to be.
      ctx = new AudioContext();
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

      // Anti-alias before the worklet decimates. Dropping 48 kHz to 16 kHz by
      // interpolating between samples folds everything above 8 kHz back down
      // into the speech band as noise. Required because we now do the
      // downsampling ourselves — a browser asked for a 16 kHz context filters
      // on our behalf, and this replaces that.
      // Skipped when the context already runs at the target rate: there is no
      // decimation happening, so the filter would only remove usable band.
      let tail: AudioNode = source;
      if (ctx.sampleRate > TARGET_SAMPLE_RATE) {
        filters = Array.from({ length: ANTI_ALIAS_STAGES }, () => {
          const filter = ctx!.createBiquadFilter();
          filter.type = "lowpass";
          filter.frequency.value = ANTI_ALIAS_HZ;
          filter.Q.value = LOWPASS_Q_DB;
          return filter;
        });
        for (const filter of filters) {
          tail.connect(filter);
          tail = filter;
        }
      }
      tail.connect(node);

      // Mobile suspends the context on an interruption — an incoming call,
      // the app going to background, a route change when headphones are
      // unplugged. Without this the worklet simply stops receiving audio and
      // the recording dies silently mid-consultation.
      ctx.onstatechange = () => {
        if (ctx?.state === "suspended") {
          void ctx.resume().catch(() => {
            /* interruption still in progress; the next event retries */
          });
        }
      };
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
        // Drop the interruption handler first: closing the context fires a
        // statechange, and the handler would try to resume what we're closing.
        if (ctx) ctx.onstatechange = null;
        node?.port.close();
        node?.disconnect();
        filters.forEach((f) => f.disconnect());
        source?.disconnect();
        stream?.getTracks().forEach((t) => t.stop());
        await ctx?.close();
      } finally {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        stream = null;
        ctx = null;
        node = null;
        source = null;
        filters = [];
        blobUrl = null;
        level = 0;
      }
    },

    getLevel() {
      return level;
    },

    isMuted() {
      // `muted` is the source-level flag (OS/hardware), not the app-level
      // `enabled` that pause() toggles — so this stays false across a pause.
      return stream?.getAudioTracks()[0]?.muted ?? false;
    },

    getDiagnostics() {
      return {
        contextSampleRate: ctx?.sampleRate ?? null,
        antiAliased: filters.length > 0,
        trackSettings: stream?.getAudioTracks()[0]?.getSettings() ?? null,
      };
    },

    async listDevices() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "audioinput");
    },
  };
}
