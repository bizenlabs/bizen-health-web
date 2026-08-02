// AudioWorklet source, loaded as a Blob URL by `audio-capture.ts`. Kept as a
// string so it ships inside the JS bundle rather than as a separate asset.
// Emits ~40 ms frames of Int16 PCM @ 16 kHz — the format Deepgram expects.
//
// The processor converts from whatever rate the AudioContext is running at
// (48 kHz on most phones, 44.1 kHz on some, 16 kHz where the browser honours
// the request) down to 16 kHz. Anti-alias filtering is NOT done here — it
// happens in the audio graph ahead of this node, where the browser's native
// biquads can do it far more cheaply. See `audio-capture.ts`.
export const WORKLET_SOURCE = /* js */ `
class PcmDownsamplerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._ratio = sampleRate / 16000;
    // ~40 ms at 16 kHz = 640 samples
    this._outFrame = 640;
    // Input samples read but not yet consumed, carried across process() calls
    // together with the sub-sample phase. Resetting these every frame — as an
    // earlier version did by clearing its whole buffer — restarts the
    // interpolator at an arbitrary offset roughly 25 times a second, putting a
    // small discontinuity into the audio at every frame boundary.
    this._carry = new Float32Array(0);
    this._phase = 0;
    this._out = new Int16Array(this._outFrame);
    this._outLen = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];

    // CRITICAL: the worklet runtime reuses the input Float32Array between
    // process() calls, so we MUST copy before retaining any of it. Without the
    // copy every retained chunk points at the same memory and gets overwritten
    // with later audio — the transcript repeats, then silence-detects out.
    const buf = new Float32Array(this._carry.length + ch.length);
    buf.set(this._carry, 0);
    buf.set(ch, this._carry.length);

    // Walk the input at the resampling ratio, interpolating between the two
    // neighbouring samples. Stops one short of the end so buf[i0 + 1] is always
    // in range; the remainder becomes carry.
    let pos = this._phase;
    while (pos + 1 < buf.length) {
      const i0 = Math.floor(pos);
      const frac = pos - i0;
      const s = buf[i0] * (1 - frac) + buf[i0 + 1] * frac;
      const clamped = Math.max(-1, Math.min(1, s));
      this._out[this._outLen++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      if (this._outLen === this._outFrame) {
        const frame = this._out;
        this.port.postMessage(frame, [frame.buffer]);
        // The transfer detaches the buffer, so the next frame needs fresh
        // storage rather than reusing this one.
        this._out = new Int16Array(this._outFrame);
        this._outLen = 0;
      }
      pos += this._ratio;
    }

    const consumed = Math.floor(pos);
    this._carry = buf.slice(consumed);
    this._phase = pos - consumed;
    return true;
  }
}

registerProcessor('pcm-downsampler', PcmDownsamplerProcessor);
`;
