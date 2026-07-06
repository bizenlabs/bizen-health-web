"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  PencilSquareIcon,
} from "@heroicons/react/20/solid";
import clsx from "clsx";
import { PatientPicker } from "@/components/patient-picker";
import type { PatientSummary } from "@/lib/patients";
import { CATEGORY_LABEL } from "@/lib/template-categories";
import {
  SPECIALTY_LABEL,
  type TemplateSpecialty,
} from "@/lib/template-specialties";
import type { TemplateSummary } from "@/lib/templates";
import { useAudioDevices } from "@/lib/transcription/use-audio-devices";

// The dictation intake / setup step — "How would you like to dictate?".
// Ported from the med-scribe POC's `TemplateSelectGrid`, then redesigned as a
// calm "clinical instrument panel": monochrome zinc, Geist Mono micro-labels,
// hairline rules, and emerald reserved strictly as the live-signal colour.

/** What the clinician chose — handed to the recorder once intake completes. */
export interface DictationChoice {
  templateId: string | null;
  templateName: string | null;
  deviceId: string | null;
  /** Optionally link this dictation to a patient. Null = unlinked. */
  patientId: string | null;
}

const PAGE_SIZE = 8;
const METER_BARS = 14;

/** Staggered load-in — sections settle in sequence, top to bottom. */
const panelVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/** A Geist Mono micro-label — the panel's recurring "instrument readout" mark. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-zinc-400 uppercase dark:text-zinc-500">
      {children}
    </span>
  );
}

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
  const [specialty, setSpecialty] = useState<TemplateSpecialty | "">("");
  const [page, setPage] = useState(1);
  const [patient, setPatient] = useState<PatientSummary | null>(null);

  // Retired templates stay referenceable by history but are hidden from pickers.
  const pickable = useMemo(
    () => templates.filter((t) => !t.retired),
    [templates],
  );

  // Only offer specialty chips for specialties the catalogue actually has.
  const specialties = useMemo(() => {
    const present = new Set<TemplateSpecialty>();
    for (const t of pickable) if (t.specialty) present.add(t.specialty);
    return [...present].sort((a, b) =>
      SPECIALTY_LABEL[a].localeCompare(SPECIALTY_LABEL[b]),
    );
  }, [pickable]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return pickable.filter((t) => {
      // A specialty chip keeps general-purpose templates visible — a
      // pediatrician still wants the plain SOAP note alongside pediatric ones.
      if (specialty && t.specialty !== null && t.specialty !== specialty) {
        return false;
      }
      if (!needle) return true;
      return (
        t.name.toLowerCase().includes(needle) ||
        (t.description ?? "").toLowerCase().includes(needle) ||
        CATEGORY_LABEL[t.category].toLowerCase().includes(needle) ||
        (t.specialty
          ? SPECIALTY_LABEL[t.specialty].toLowerCase().includes(needle)
          : false)
      );
    });
  }, [pickable, search, specialty]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const choose = useCallback(
    (templateId: string | null, templateName: string | null) =>
      onReady({
        templateId,
        templateName,
        deviceId: selectedDeviceId,
        patientId: patient?.id ?? null,
      }),
    [onReady, selectedDeviceId, patient],
  );

  const canPickDevice = hasLabels && devices.length > 1;

  return (
    <motion.div
      variants={panelVariants}
      initial="hidden"
      animate="show"
      className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="px-6 pt-6 sm:px-8 sm:pt-7">
        <Eyebrow>Setup</Eyebrow>
        <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          How would you like to dictate?
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose a microphone, then pick a note template or dictate free-form.
        </p>
      </motion.div>

      {/* Microphone */}
      <motion.div variants={itemVariants} className="mt-5 px-6 sm:mt-6 sm:px-8">
        <Eyebrow>Microphone</Eyebrow>
        <div className="mt-2 flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            <MicrophoneIcon className="size-4" />
          </span>
          {canPickDevice ? (
            <select
              aria-label="Microphone"
              value={selectedDeviceId ?? ""}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-sm text-zinc-800 focus:outline-none dark:text-zinc-200"
            >
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || "Microphone"}
                </option>
              ))}
            </select>
          ) : (
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
              {devices[0]?.label || "Default microphone"}
            </span>
          )}
          <MicLevelMeter deviceId={selectedDeviceId} onActive={refresh} />
        </div>
      </motion.div>

      {/* Patient — optional link so the dictation files under a patient record
          and is findable from it later. */}
      <motion.div variants={itemVariants} className="mt-5 px-6 sm:mt-6 sm:px-8">
        <span className="flex items-baseline gap-2">
          <Eyebrow>Patient</Eyebrow>
          <span className="font-mono text-[10px] tracking-wider text-zinc-300 lowercase dark:text-zinc-600">
            optional
          </span>
        </span>
        <div className="mt-2">
          <PatientPicker value={patient} onChange={setPatient} />
        </div>
      </motion.div>

      {/* Hairline */}
      <motion.div
        variants={itemVariants}
        className="mt-6 border-t border-zinc-100 dark:border-zinc-800/80"
      />

      {/* Free-form */}
      <motion.div variants={itemVariants} className="px-6 pt-6 sm:px-8">
        <Eyebrow>Free-form</Eyebrow>
        <button
          type="button"
          onClick={() => choose(null, null)}
          className="group mt-2 flex w-full items-center gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-4 text-left transition-all hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-zinc-600"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 transition-colors group-hover:bg-zinc-900 group-hover:text-white dark:bg-zinc-700 dark:text-zinc-300 dark:group-hover:bg-zinc-100 dark:group-hover:text-zinc-900">
            <PencilSquareIcon className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Free-form dictation
            </span>
            <span className="block text-xs text-zinc-500 dark:text-zinc-400">
              Speak freely without a template structure
            </span>
          </span>
          <ChevronRightIcon className="size-4 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400" />
        </button>
      </motion.div>

      {/* Templates */}
      <motion.div
        variants={itemVariants}
        className="px-6 pt-6 pb-6 sm:px-8 sm:pb-8"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-baseline gap-2">
            <Eyebrow>Templates</Eyebrow>
            {pickable.length > 0 ? (
              <span className="font-mono text-[10px] tracking-wider text-zinc-300 tabular-nums dark:text-zinc-600">
                {String(filtered.length).padStart(2, "0")}
              </span>
            ) : null}
          </span>
          {pickable.length > 0 ? (
            <div className="relative w-52">
              <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search templates…"
                className="w-full rounded-lg border border-zinc-200 py-1.5 pr-3 pl-8 text-sm placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-900/5 focus:outline-none dark:border-zinc-800 dark:bg-transparent dark:focus:border-zinc-700"
              />
            </div>
          ) : null}
        </div>

        {specialties.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <SpecialtyChip
              active={specialty === ""}
              onClick={() => {
                setSpecialty("");
                setPage(1);
              }}
            >
              All
            </SpecialtyChip>
            {specialties.map((s) => (
              <SpecialtyChip
                key={s}
                active={specialty === s}
                onClick={() => {
                  setSpecialty(specialty === s ? "" : s);
                  setPage(1);
                }}
              >
                {SPECIALTY_LABEL[s]}
              </SpecialtyChip>
            ))}
          </div>
        ) : null}

        {pickable.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            No templates available. Create one under Settings → Note templates,
            or use free-form dictation above.
          </p>
        ) : filtered.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            No templates matching your filters.
          </p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {paginated.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => choose(t.id, t.name)}
                  className="group flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-900/5 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-emerald-700/70"
                >
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500 transition-colors group-hover:bg-emerald-100 group-hover:text-emerald-600 dark:bg-zinc-700 dark:text-zinc-400 dark:group-hover:bg-emerald-950/60 dark:group-hover:text-emerald-400">
                    <DocumentTextIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-900 group-hover:text-emerald-700 dark:text-zinc-100 dark:group-hover:text-emerald-400">
                      {t.name}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <span className="font-mono text-[10px] tracking-wide text-zinc-400 uppercase dark:text-zinc-500">
                        {CATEGORY_LABEL[t.category]}
                      </span>
                      {t.effectiveDefault ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                          <span className="size-1 rounded-full bg-emerald-500" />
                          Default
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {totalPages > 1 ? (
              <div className="mt-5 flex items-center justify-between">
                <PagerButton
                  label="Previous templates"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={safePage <= 1}
                >
                  <ChevronLeftIcon className="size-4" />
                </PagerButton>
                <span className="font-mono text-xs tracking-[0.15em] text-zinc-400 tabular-nums dark:text-zinc-500">
                  {String(safePage).padStart(2, "0")} ·{" "}
                  {String(totalPages).padStart(2, "0")}
                </span>
                <PagerButton
                  label="Next templates"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={safePage >= totalPages}
                >
                  <ChevronRightIcon className="size-4" />
                </PagerButton>
              </div>
            ) : null}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function SpecialtyChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
          : "border-zinc-200 text-zinc-500 hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-600 dark:hover:text-zinc-200",
      )}
    >
      {children}
    </button>
  );
}

function PagerButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-8 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition-colors enabled:hover:border-zinc-300 enabled:hover:text-zinc-800 disabled:opacity-30 dark:border-zinc-800 dark:text-zinc-400 dark:enabled:hover:border-zinc-700 dark:enabled:hover:text-zinc-200"
    >
      {children}
    </button>
  );
}

type MeterStatus = "pending" | "live" | "muted" | "denied";

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
  const [status, setStatus] = useState<MeterStatus>("pending");

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    let raf = 0;
    let track: MediaStreamTrack | null = null;

    // A resolved stream isn't necessarily producing audio: macOS keeps the
    // internal-mic track but marks it muted at the source when the lid is
    // closed (the OS or another app can mute it too). Reflect that as
    // "no signal" instead of a misleading "Live".
    const syncMuted = () => {
      if (!cancelled) setStatus(track?.muted ? "muted" : "live");
    };

    async function run() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        track = stream.getAudioTracks()[0] ?? null;
        track?.addEventListener("mute", syncMuted);
        track?.addEventListener("unmute", syncMuted);
        syncMuted();
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
      track?.removeEventListener("mute", syncMuted);
      track?.removeEventListener("unmute", syncMuted);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
    };
  }, [deviceId, onActive]);

  const activeBars = status === "live" ? Math.round(level * METER_BARS) : 0;
  const statusLabel =
    status === "live"
      ? "Live"
      : status === "muted"
        ? "No signal"
        : status === "denied"
          ? "Blocked"
          : "Waiting";

  return (
    <span className="flex shrink-0 items-center gap-2.5">
      <span
        className="flex items-end gap-[2px]"
        title={
          status === "denied"
            ? "Microphone access blocked"
            : status === "pending"
              ? "Waiting for microphone…"
              : status === "muted"
                ? "No microphone signal — the source is muted (e.g. the laptop lid is closed)"
                : "Microphone input level"
        }
      >
        {Array.from({ length: METER_BARS }, (_, i) => (
          <span
            key={i}
            className={clsx(
              "w-[2px] rounded-full transition-[background-color] duration-75",
              i < activeBars
                ? "bg-emerald-500"
                : status === "denied"
                  ? "bg-red-300 dark:bg-red-900/70"
                  : "bg-zinc-200 dark:bg-zinc-700",
            )}
            style={{ height: `${4 + i * 1}px` }}
          />
        ))}
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className={clsx(
            "size-1.5 rounded-full",
            status === "live" && "bg-emerald-500",
            status === "muted" && "bg-amber-500",
            status === "pending" &&
              "animate-pulse bg-zinc-300 dark:bg-zinc-600",
            status === "denied" && "bg-red-500",
          )}
        />
        <span
          className={clsx(
            "font-mono text-[9px] font-medium tracking-[0.12em] uppercase",
            status === "live"
              ? "text-emerald-600 dark:text-emerald-400"
              : status === "muted"
                ? "text-amber-600 dark:text-amber-400"
                : status === "denied"
                  ? "text-red-500 dark:text-red-400"
                  : "text-zinc-400 dark:text-zinc-500",
          )}
        >
          {statusLabel}
        </span>
      </span>
    </span>
  );
}
