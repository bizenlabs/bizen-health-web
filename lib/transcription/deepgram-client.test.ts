import { describe, expect, it } from "vitest";
import { buildListenUrl } from "./deepgram-client";
import {
  modelForTranscriptionLanguage,
  isSupportedTranscriptionLanguage,
} from "./languages";

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
