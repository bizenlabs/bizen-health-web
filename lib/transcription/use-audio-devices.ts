"use client";

import { useCallback, useEffect, useState } from "react";

// Enumerates the browser's audio-input devices for the dictation intake
// step. Ported in spirit from the med-scribe POC's `useAudioDevices`, but
// browser-native: med-scribe asked Tauri/CoreAudio, we ask
// `navigator.mediaDevices`.
//
// One browser quirk drives the shape of this hook: `enumerateDevices()`
// returns devices with **empty labels** until the page has been granted mic
// permission. `hasLabels` lets the UI tell "we have a real device list" from
// "we have placeholders" — the mic test grants permission, then `refresh()`
// repopulates the list with real names.

export interface AudioInputDevice {
  deviceId: string;
  label: string;
}

export interface UseAudioDevicesResult {
  devices: AudioInputDevice[];
  selectedDeviceId: string | null;
  setSelectedDeviceId: (id: string) => void;
  /** True once the browser has handed back real device labels. */
  hasLabels: boolean;
  refresh: () => Promise<void>;
}

export function useAudioDevices(): UseAudioDevicesResult {
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [hasLabels, setHasLabels] = useState(false);

  const refresh = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all
        .filter((d) => d.kind === "audioinput" && d.deviceId)
        .map((d) => ({ deviceId: d.deviceId, label: d.label }));
      setDevices(inputs);
      setHasLabels(inputs.some((d) => d.label !== ""));
      setSelectedDeviceId((prev) => {
        if (prev && inputs.some((d) => d.deviceId === prev)) return prev;
        // The OS default mic surfaces under the well-known "default" id.
        const def = inputs.find((d) => d.deviceId === "default");
        return def?.deviceId ?? inputs[0]?.deviceId ?? null;
      });
    } catch {
      // Enumeration unsupported or blocked — dictation still works with the
      // browser's default microphone, so this is non-fatal.
    }
  }, []);

  useEffect(() => {
    // refresh() awaits enumerateDevices() before any setState — an async
    // external-system read, not a synchronous cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const md = navigator.mediaDevices;
    if (!md) return;
    md.addEventListener("devicechange", refresh);
    return () => md.removeEventListener("devicechange", refresh);
  }, [refresh]);

  return { devices, selectedDeviceId, setSelectedDeviceId, hasLabels, refresh };
}
