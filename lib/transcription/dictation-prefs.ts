"use client";

import { useCallback, useSyncExternalStore } from "react";

// Personal dictation preferences, stored per browser in localStorage. Shared
// between the dictation editor's in-recording popover and the settings page so
// both read and write the same values. These are device-local, per-clinician
// preferences — not tenant configuration — so they never touch the backend.

export const VOICE_COMMANDS_KEY = "bizen:dictation:voiceCommands";
export const SPOKEN_PUNCTUATION_KEY = "bizen:dictation:spokenPunctuation";

export const VOICE_COMMANDS_DEFAULT = true;
export const SPOKEN_PUNCTUATION_DEFAULT = false;

// localStorage `storage` events only fire in OTHER tabs; this event covers
// same-tab writes so every subscribed control re-reads immediately.
const PREFS_EVENT = "bizen:dictation-prefs";

/**
 * Read a persisted boolean preference. Returns `fallback` on the server (no
 * localStorage) and when nothing is stored.
 */
export function readStoredBool(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

/** Persist a boolean preference. Best-effort — storage errors are swallowed. */
export function writeStoredBool(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* localStorage unavailable */
  }
  window.dispatchEvent(new Event(PREFS_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(PREFS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(PREFS_EVENT, onChange);
  };
}

/**
 * A stored preference as reactive state. Hydration-safe: the server (and
 * hydration) snapshot is `fallback`, then the stored value takes over on the
 * client — no mismatch warning, no setState-in-effect.
 */
export function useStoredBool(
  key: string,
  fallback: boolean,
): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readStoredBool(key, fallback),
    () => fallback,
  );
  const setValue = useCallback(
    (next: boolean) => writeStoredBool(key, next),
    [key],
  );
  return [value, setValue];
}
