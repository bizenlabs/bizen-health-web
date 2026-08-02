// Transcription language/accent options offered per tenant, the default, and
// the Deepgram model each one requires.
//
// Deepgram splits along a model boundary we have to respect:
//   - English accent variants run on `nova-3-medical`, which keeps the
//     medical-tuned vocabulary but is English-only.
//   - Every non-English language (Hindi, the multilingual code-switching
//     "multi" option, and the regional Indian languages) runs on the general
//     `nova-3` model — the medical model does not support them.
// So the chosen language determines the model; `modelForTranscriptionLanguage`
// is the single source of that mapping.
//
// Only languages Deepgram actually supports in real-time STREAMING on these
// models belong here, so a tenant can never select one that silently fails.
//
// Plain module — no "server-only"/"use client" — so server pages, the settings
// client form, and the browser Deepgram client can all import it.

export const DEFAULT_TRANSCRIPTION_LANGUAGE = "en-IN";

// Medical-tuned, English-only. General model — all other languages.
const MEDICAL_MODEL = "nova-3-medical";
const GENERAL_MODEL = "nova-3";

export type TranscriptionLanguageGroup = "English" | "Indian languages";

export const TRANSCRIPTION_LANGUAGES = [
  // English accent variants — keep the medical-tuned model.
  {
    code: "en-IN",
    label: "English — Indian accent",
    group: "English",
    model: MEDICAL_MODEL,
  },
  {
    code: "en",
    label: "English — all accents",
    group: "English",
    model: MEDICAL_MODEL,
  },
  {
    code: "en-US",
    label: "English — US",
    group: "English",
    model: MEDICAL_MODEL,
  },
  {
    code: "en-GB",
    label: "English — UK",
    group: "English",
    model: MEDICAL_MODEL,
  },
  {
    code: "en-AU",
    label: "English — Australian",
    group: "English",
    model: MEDICAL_MODEL,
  },
  // Non-English — general nova-3 (no medical vocabulary). "multi" transcribes
  // mixed Hindi + English (code-switching) in one stream — the common pattern
  // for clinicians who speak Hindi but say drug/term names in English.
  {
    code: "multi",
    label: "Hindi + English (mixed)",
    group: "Indian languages",
    model: GENERAL_MODEL,
  },
  {
    code: "hi",
    label: "Hindi",
    group: "Indian languages",
    model: GENERAL_MODEL,
  },
  {
    code: "mr",
    label: "Marathi",
    group: "Indian languages",
    model: GENERAL_MODEL,
  },
  {
    code: "bn",
    label: "Bengali",
    group: "Indian languages",
    model: GENERAL_MODEL,
  },
  {
    code: "ta",
    label: "Tamil",
    group: "Indian languages",
    model: GENERAL_MODEL,
  },
  {
    code: "te",
    label: "Telugu",
    group: "Indian languages",
    model: GENERAL_MODEL,
  },
] as const;

export type TranscriptionLanguageCode =
  (typeof TRANSCRIPTION_LANGUAGES)[number]["code"];

export function isSupportedTranscriptionLanguage(code: string): boolean {
  return TRANSCRIPTION_LANGUAGES.some((l) => l.code === code);
}

export function transcriptionLanguageLabel(code: string): string {
  return TRANSCRIPTION_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}

// The Deepgram model a given language must run on. Unknown codes fall back to
// the medical model (the historical default was English on nova-3-medical).
export function modelForTranscriptionLanguage(code: string): string {
  return (
    TRANSCRIPTION_LANGUAGES.find((l) => l.code === code)?.model ?? MEDICAL_MODEL
  );
}

// English variants are the only ones on the medical model and the only ones
// that support the metric-`measurements` formatting feature.
export function isEnglishTranscriptionLanguage(code: string): boolean {
  return code === "en" || code.startsWith("en-");
}
