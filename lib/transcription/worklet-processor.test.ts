import { describe, expect, it } from "vitest";
import { WORKLET_SOURCE } from "./worklet-processor";

// The worklet ships as a source string evaluated inside the AudioWorklet
// global scope, so it can't be imported directly. These tests stand up a
// minimal stand-in for that scope and drive the processor the way the audio
// runtime does — 128-sample blocks, one channel — because the resampling maths
// is both easy to get wrong and impossible to notice going wrong: bad output
// still sounds like speech, it just transcribes worse.

const BLOCK = 128;
const OUT_FRAME = 640;

interface Processor {
  process(inputs: Float32Array[][]): boolean;
}

function loadWorklet(contextRate: number): {
  processor: Processor;
  frames: Int16Array[];
} {
  const frames: Int16Array[] = [];

  class FakeAudioWorkletProcessor {
    port = {
      postMessage: (data: Int16Array) => {
        // The real runtime transfers the buffer, detaching it. Snapshot so
        // assertions read stable data.
        frames.push(new Int16Array(data));
      },
    };
  }

  // Held on an object rather than in a plain `let`: the assignment happens
  // inside the evaluated worklet source, which the compiler can't see, so a
  // local would narrow to `never` after its null initialiser.
  const registry: { Ctor: (new () => Processor) | null } = { Ctor: null };
  const registerProcessor = (_name: string, cls: unknown) => {
    registry.Ctor = cls as new () => Processor;
  };

  new Function(
    "AudioWorkletProcessor",
    "registerProcessor",
    "sampleRate",
    WORKLET_SOURCE,
  )(FakeAudioWorkletProcessor, registerProcessor, contextRate);

  if (!registry.Ctor) throw new Error("worklet did not register a processor");
  return { processor: new registry.Ctor(), frames };
}

// Feeds a signal through the processor in the 128-sample blocks the audio
// runtime uses.
function feed(processor: Processor, samples: Float32Array): void {
  for (let i = 0; i < samples.length; i += BLOCK) {
    processor.process([[samples.slice(i, i + BLOCK)]]);
  }
}

function ramp(length: number): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = (i / length) * 2 - 1;
  return out;
}

function totalSamples(frames: Int16Array[]): number {
  return frames.reduce((n, f) => n + f.length, 0);
}

describe("pcm-downsampler worklet", () => {
  // 48 kHz divides into 16 kHz exactly, so it exercises the easy path; 44.1 kHz
  // gives a 2.75625:1 ratio where the resampler never lands on a sample
  // boundary and has to carry a fractional phase between blocks. The second
  // case is where the previous implementation went wrong — it discarded its
  // unconsumed tail after every output frame.
  for (const rate of [48000, 44100]) {
    it(`emits uniform 640-sample frames from a ${rate} Hz context`, () => {
      const { processor, frames } = loadWorklet(rate);
      feed(processor, ramp(rate * 2));

      expect([...new Set(frames.map((f) => f.length))]).toEqual([OUT_FRAME]);
    });

    it(`holds the 16 kHz output rate from a ${rate} Hz context`, () => {
      const { processor, frames } = loadWorklet(rate);
      feed(processor, ramp(rate * 10));

      // Ten seconds of input must yield ten seconds of output, within one
      // frame. This is a standing invariant rather than a regression guard —
      // the previous implementation stayed inside this bound too — but the
      // sample count is what usage is billed from, so it is worth pinning.
      expect(Math.abs(totalSamples(frames) - 160000)).toBeLessThanOrEqual(
        OUT_FRAME,
      );
    });
  }

  it("interpolates monotonically through a ramp", () => {
    // Guards the interpolation arithmetic itself: a rising input must produce a
    // rising output, with no step far larger than the average.
    const { processor, frames } = loadWorklet(44100);
    feed(processor, ramp(88200));

    const all = frames.flatMap((f) => Array.from(f));
    expect(all.length).toBeGreaterThan(OUT_FRAME * 3);
    expect(all.filter((v, i) => i > 0 && v < all[i - 1])).toEqual([]);
    const deltas = all.slice(1).map((v, i) => v - all[i]);
    expect(Math.max(...deltas)).toBeLessThanOrEqual(4);
  });

  it("passes a 16 kHz context through without resampling", () => {
    const { processor, frames } = loadWorklet(16000);
    const input = new Float32Array(BLOCK * 10);
    for (let i = 0; i < input.length; i++) input[i] = 0.5;
    feed(processor, input);

    expect(frames).toHaveLength(1);
    // 0.5 → 0.5 * 0x7fff, truncated on assignment into Int16Array.
    expect(Array.from(frames[0].slice(0, 8))).toEqual(Array(8).fill(16383));
  });

  it("copies input blocks the runtime reuses", () => {
    // The audio runtime hands back the same Float32Array on every call. Without
    // an internal copy, retained audio gets overwritten by later blocks — the
    // transcript repeats a phrase and then silence-detects out.
    const { processor, frames } = loadWorklet(48000);
    const scratch = new Float32Array(BLOCK);

    for (let block = 0; block < 60; block++) {
      scratch.fill(block % 2 === 0 ? 0.5 : -0.5);
      processor.process([[scratch]]);
    }

    const seen = new Set(frames.flatMap((f) => Array.from(f)));
    // Both polarities must survive. If the copy is missing, every retained
    // block reads as whichever value was written last.
    expect(seen.has(16383)).toBe(true);
    expect(seen.has(-16384)).toBe(true);
  });

  it("survives blocks with no input channel", () => {
    const { processor } = loadWorklet(48000);
    expect(processor.process([[]])).toBe(true);
    expect(processor.process([])).toBe(true);
  });
});
