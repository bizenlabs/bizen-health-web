"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MagnifyingGlassIcon, MicrophoneIcon } from "@heroicons/react/20/solid";
import { CATEGORY_LABEL } from "@/lib/template-categories";
import type { TemplateSummary } from "@/lib/templates";
import { useAudioDevices } from "@/lib/transcription/use-audio-devices";

// The dictation intake / setup step — "How would you like to dictate?".
// Ported from the med-scribe POC's `TemplateSelectGrid`: the clinician picks a
// note template (or free-form) and a microphone before any recording starts.
// Rebuilt on Next.js + the platform's Tailwind conventions.

/** What the clinician chose — handed to the recorder once intake completes. */
export interface DictationChoice {
  templateId: string | null;
  templateName: string | null;
  deviceId: string | null;
}

const PAGE_SIZE = 8;
const METER_BARS = 9;

export function DictationIntake({
  templates,
  onReady,
}: {
  templates: TemplateSummary[];
  onReady: (choice: DictationChoice) => void;
}) {
  const { devices, selectedDeviceId, setSelectedDeviceId, hasLabels, refresh } =
    useAudioDevices();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Retired templates stay referenceable by history but are hidden from pickers.
  const pickable = useMemo(
    () => templates.filter((t) => !t.retired),
    [templates],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return pickable;
    return pickable.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        (t.description ?? "").toLowerCase().includes(needle) ||
        CATEGORY_LABEL[t.category].toLowerCase().includes(needle),
    );
  }, [pickable, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const choose = useCallback(
    (templateId: string | null, templateName: string | null) =>
      onReady({ templateId, templateName, deviceId: selectedDeviceId }),
    [onReady, selectedDeviceId],
  );

  const canPickDevice = hasLabels && devices.length > 1;

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="text-center">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          How would you like to dictate?
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose a template for a structured note, or go free-form.
        </p>
      </div>

      {/* Microphone — selector and live level meter share one control box. */}
      <div className="mt-6">
        <label className="flex items-center gap-1.5 text-xs font-medium tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
          <MicrophoneIcon className="size-3.5" />
          Microphone
        </label>
        <div className="mt-1.5 flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-800 dark:bg-zinc-800/50">
          {canPickDevice ? (
            <select
              value={selectedDeviceId ?? ""}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm focus:outline-none"
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Microphone"}
                </option>
              ))}
            </select>
          ) : (
            <span className="min-w-0 flex-1 truncate py-1 text-sm text-zinc-600 dark:text-zinc-300">
              {devices[0]?.label || "Default microphone"}
            </span>
          )}
          <MicLevelMeter deviceId={selectedDeviceId} onActive={refresh} />
        </div>
      </div>

      {/* Free-form */}
      <button
        type="button"
        onClick={() => choose(null, null)}
        className="mt-6 flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3.5 text-left transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-zinc-600"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-700">
          <MicrophoneIcon className="size-5 text-zinc-600 dark:text-zinc-300" />
        </span>
        <span>
          <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Free-form dictation
          </span>
          <span className="block text-xs text-zinc-500 dark:text-zinc-400">
            Speak freely without a template structure
          </span>
        </span>
      </button>

      {/* Templates */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <span className="text-xs font-medium tracking-wider text-zinc-400 uppercase dark:text-zinc-500">
          Templates
        </span>
        {pickable.length > 0 ? (
          <div className="relative w-56">
            <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search templates…"
              className="w-full rounded-md border border-zinc-200 py-1.5 pr-3 pl-8 text-sm dark:border-zinc-800 dark:bg-transparent"
            />
          </div>
        ) : null}
      </div>

      {pickable.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          No templates available. Create one under Settings → Note templates, or
          use free-form dictation above.
        </p>
      ) : filtered.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          No templates matching “{search}”.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {paginated.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => choose(t.id, t.name)}
                className="group rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left transition-all hover:border-emerald-300 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-emerald-700"
              >
                <span className="block text-sm font-medium text-zinc-900 group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-emerald-400">
                  {t.name}
                </span>
                <span className="mt-1.5 flex items-center gap-1.5">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {CATEGORY_LABEL[t.category]}
                  </span>
                  {t.isDefault ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      Default
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={safePage <= 1}
                className="rounded-md border border-zinc-200 px-3 py-1 text-zinc-700 enabled:hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-200 dark:enabled:hover:bg-zinc-900"
              >
                Previous
              </button>
              <span className="text-zinc-500">
                Page {safePage} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={safePage >= totalPages}
                className="rounded-md border border-zinc-200 px-3 py-1 text-zinc-700 enabled:hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-200 dark:enabled:hover:bg-zinc-900"
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * A live microphone level meter. Acquires the mic as soon as it mounts (no
 * explicit "test" click) and re-acquires whenever `deviceId` changes, so the
 * bars always reflect the currently selected input. Granting access also
 * populates real device labels — `onActive` lets the parent re-enumerate.
 */
function MicLevelMeter({
  deviceId,
  onActive,
}: {
  deviceId: string | null;
  onActive: () => void;
}) {
  const [level, setLevel] = useState(0);
  const [status, setStatus] = useState<"pending" | "live" | "denied">(
    "pending",
  );

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;

    async function run() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setStatus("live");
        onActive();

        ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        source.connect(analyser);

        // Measure loudness as the RMS of the time-domain waveform — averaging
        // the *frequency* spectrum under-reads badly, since speech occupies
        // only a sliver of it. RMS is then mapped on a dB scale (how loudness
        // is actually perceived): −55 dBFS ≈ silence, −12 dBFS ≈ loud speech.
        const buf = new Uint8Array(analyser.fftSize);
        let smoothed = 0;
        const tick = () => {
          if (cancelled) return;
          analyser.getByteTimeDomainData(buf);
          let sumSq = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128; // byte sample → −1..1
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / buf.length);
          const db = 20 * Math.log10(Math.max(rms, 1e-7));
          const norm = Math.min(1, Math.max(0, (db + 55) / 43));
          // Snap up instantly, ease down — feels responsive without flicker.
          smoothed = norm > smoothed ? norm : smoothed * 0.85 + norm * 0.15;
          setLevel(smoothed);
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        if (!cancelled) setStatus("denied");
      }
    }
    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
    };
  }, [deviceId, onActive]);

  const activeBars = status === "live" ? Math.round(level * METER_BARS) : 0;

  return (
    <span
      className="flex shrink-0 items-end gap-[2px] pr-1"
      title={
        status === "denied"
          ? "Microphone access blocked"
          : status === "pending"
            ? "Waiting for microphone…"
            : "Microphone input level"
      }
    >
      {Array.from({ length: METER_BARS }, (_, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full transition-colors duration-75 ${
            i < activeBars
              ? "bg-emerald-500"
              : status === "denied"
                ? "bg-red-300 dark:bg-red-900/60"
                : "bg-zinc-300 dark:bg-zinc-600"
          }`}
          style={{ height: `${6 + i * 1.5}px` }}
        />
      ))}
    </span>
  );
}
