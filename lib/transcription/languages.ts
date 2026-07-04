// Transcription language/accent options offered per tenant, and the default.
//
// These are the accent variants of Deepgram's `nova-3-medical` model (which is
// English-only). "en-IN" transcribes Indian-accented English; "en" is the
// all-accents general model; the rest pin a specific regional accent. A clinic
// picks one default in Settings → Transcription and it feeds Deepgram's
// `language` param.
//
// Non-English languages (Hindi, Marathi, …) are NOT here yet: they need the
// general `nova-3` model (`language=hi`/`multi`), not the medical one, so they
// require a model switch as a follow-up. Keep this list to what the current
// model actually supports so a tenant can't select a language that silently
// fails.
//
// Plain module — no "server-only"/"use client" — so server pages, the settings
// client form, and the browser Deepgram client can all import it.

export const DEFAULT_TRANSCRIPTION_LANGUAGE = "en-IN";

export const TRANSCRIPTION_LANGUAGES = [
  { code: "en-IN", label: "English — Indian accent" },
  { code: "en", label: "English — all accents" },
  { code: "en-US", label: "English — US" },
  { code: "en-GB", label: "English — UK" },
  { code: "en-AU", label: "English — Australian" },
] as const;

export type TranscriptionLanguageCode =
  (typeof TRANSCRIPTION_LANGUAGES)[number]["code"];

export function isSupportedTranscriptionLanguage(code: string): boolean {
  return TRANSCRIPTION_LANGUAGES.some((l) => l.code === code);
}

export function transcriptionLanguageLabel(code: string): string {
  return TRANSCRIPTION_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}
