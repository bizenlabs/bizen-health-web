// AudioWorklet source, loaded as a Blob URL by `audio-capture.ts`. Kept as a
// string so it ships inside the JS bundle rather than as a separate asset.
// Emits ~40 ms frames of Int16 PCM @ 16 kHz — the format Deepgram expects.
//
// Ported from the med-scribe POC (lib/audio/worklet-processor.ts).
export const WORKLET_SOURCE = /* js */ `
class PcmDownsamplerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._inRate = sampleRate;
    this._outRate = 16000;
    this._ratio = this._inRate / this._outRate;
    // ~40 ms at 16 kHz = 640 samples
    this._outFrame = 640;
    this._buf = [];
    this._bufLen = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];

    // CRITICAL: the worklet runtime reuses the input Float32Array between
    // process() calls, so we MUST copy before buffering. Without the copy
    // every buffered chunk points at the same memory and gets overwritten
    // with later audio — the transcript repeats, then silence-detects out.
    const copy = new Float32Array(ch.length);
    copy.set(ch);
    this._buf.push(copy);
    this._bufLen += copy.length;

    const needed = Math.ceil(this._outFrame * this._ratio);
    if (this._bufLen < needed) return true;

    const merged = new Float32Array(this._bufLen);
    let off = 0;
    for (const b of this._buf) {
      merged.set(b, off);
      off += b.length;
    }
    this._buf = [];
    this._bufLen = 0;

    const outLen = Math.floor(merged.length / this._ratio);
    const out = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const srcIdx = i * this._ratio;
      const i0 = Math.floor(srcIdx);
      const i1 = Math.min(i0 + 1, merged.length - 1);
      const frac = srcIdx - i0;
      const s = merged[i0] * (1 - frac) + merged[i1] * frac;
      const clamped = Math.max(-1, Math.min(1, s));
      out[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }
    this.port.postMessage(out, [out.buffer]);
    return true;
  }
}

registerProcessor('pcm-downsampler', PcmDownsamplerProcessor);
`;
