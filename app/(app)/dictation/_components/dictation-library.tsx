"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ChevronRightIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  MicrophoneIcon,
  PencilSquareIcon,
  PlusIcon,
} from "@heroicons/react/20/solid";
import clsx from "clsx";
import type {
  TranscriptionStatus,
  TranscriptionSummary,
} from "@/lib/transcriptions";

// The dictation library — the home of the dictation area. A grouped,
// searchable, status-aware list of past dictations; "New dictation" routes to
// the setup panel at /dictation/new. Same "clinical instrument panel" language
// as the intake step: monochrome zinc, Geist Mono micro-labels, emerald as the
// live/notable signal colour.

const FREE_FORM = "__free-form__";

const listVariants = {
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

/** A Geist Mono micro-label — the recurring "instrument readout" mark. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] font-medium tracking-[0.2em] text-zinc-400 uppercase dark:text-zinc-500">
      {children}
    </span>
  );
}

type Bucket = "today" | "yesterday" | "earlier";

/** Classify a timestamp into a recency bucket against the local day. */
function recencyBucket(iso: string): Bucket {
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round(
    (startOf(new Date()) - startOf(new Date(iso))) / 86_400_000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return "earlier";
}

/** Within-day groups show the time; older rows also carry the date. */
function formatWhen(iso: string, bucket: Bucket): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (bucket === "earlier") {
    return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
  }
  return time;
}

function rowLabel(
  d: TranscriptionSummary,
  names: Record<string, string>,
): string {
  if (!d.templateId) return "Free-form dictation";
  return names[d.templateId] ?? "Template-based dictation";
}

export function DictationLibrary({
  dictations,
  templateNames,
}: {
  dictations: TranscriptionSummary[];
  templateNames: Record<string, string>;
}) {
  const [search, setSearch] = useState("");
  const [templateFilter, setTemplateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | TranscriptionStatus>(
    "",
  );

  // Filter dropdown only offers values that actually occur in the data.
  const templateOptions = useMemo(() => {
    const seen = new Map<string, string>();
    let hasFreeForm = false;
    for (const d of dictations) {
      if (!d.templateId) hasFreeForm = true;
      else if (!seen.has(d.templateId)) {
        seen.set(d.templateId, templateNames[d.templateId] ?? "Template-based");
      }
    }
    return {
      hasFreeForm,
      templates: [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])),
    };
  }, [dictations, templateNames]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return dictations.filter((d) => {
      if (statusFilter && d.status !== statusFilter) return false;
      if (templateFilter === FREE_FORM && d.templateId) return false;
      if (
        templateFilter &&
        templateFilter !== FREE_FORM &&
        d.templateId !== templateFilter
      ) {
        return false;
      }
      if (needle && !rowLabel(d, templateNames).toLowerCase().includes(needle))
        return false;
      return true;
    });
  }, [dictations, search, templateFilter, statusFilter, templateNames]);

  const groups = useMemo(() => {
    const sorted = [...filtered].sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
    const buckets: Record<Bucket, TranscriptionSummary[]> = {
      today: [],
      yesterday: [],
      earlier: [],
    };
    for (const d of sorted) buckets[recencyBucket(d.startedAt)].push(d);
    return (
      [
        ["today", "Today"],
        ["yesterday", "Yesterday"],
        ["earlier", "Earlier"],
      ] as const
    )
      .map(([key, label]) => ({ key, label, items: buckets[key] }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  const empty = dictations.length === 0;

  return (
    <motion.div
      variants={listVariants}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-2xl px-6 py-10 sm:py-12"
    >
      {/* Header */}
      <motion.header
        variants={itemVariants}
        className="flex items-start justify-between gap-4"
      >
        <div>
          <Eyebrow>Clinical dictation</Eyebrow>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            Dictation
          </h1>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            Hands-free clinical notes. Audio is not stored — only the
            transcript.
          </p>
        </div>
        {/* When empty, the empty-state card carries the only "New" action. */}
        {empty ? null : (
          <Link
            href="/dictation/new"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            New dictation
          </Link>
        )}
      </motion.header>

      {empty ? (
        <motion.div
          variants={itemVariants}
          className="mt-8 flex flex-col items-center rounded-2xl border border-dashed border-zinc-200 px-6 py-14 text-center dark:border-zinc-800"
        >
          <span className="flex size-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
            <MicrophoneIcon aria-hidden="true" className="size-6" />
          </span>
          <h2 className="mt-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            No dictations yet
          </h2>
          <p className="mt-1 max-w-xs text-sm text-zinc-500 dark:text-zinc-400">
            Get started by creating a new dictation.
          </p>
          <Link
            href="/dictation/new"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <PlusIcon aria-hidden="true" className="size-4" />
            New dictation
          </Link>
        </motion.div>
      ) : (
        <>
          {/* Filter bar */}
          <motion.div
            variants={itemVariants}
            className="mt-7 flex flex-wrap items-center gap-2.5"
          >
            <div className="relative min-w-[12rem] flex-1">
              <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dictations…"
                className="w-full rounded-lg border border-zinc-200 py-1.5 pr-3 pl-8 text-sm placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-900/5 focus:outline-none dark:border-zinc-800 dark:bg-transparent dark:focus:border-zinc-700"
              />
            </div>
            <select
              aria-label="Filter by template"
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-transparent dark:text-zinc-300"
            >
              <option value="">All templates</option>
              {templateOptions.hasFreeForm ? (
                <option value={FREE_FORM}>Free-form</option>
              ) : null}
              {templateOptions.templates.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "" | TranscriptionStatus)
              }
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-transparent dark:text-zinc-300"
            >
              <option value="">Any status</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="FAILED">Failed</option>
            </select>
          </motion.div>

          {/* List */}
          <motion.div variants={itemVariants} className="mt-6">
            {groups.length === 0 ? (
              <p className="rounded-xl border border-dashed border-zinc-200 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                No dictations match your search.
              </p>
            ) : (
              <div className="space-y-6">
                {groups.map((group) => (
                  <section key={group.key}>
                    <div className="flex items-baseline gap-2">
                      <Eyebrow>{group.label}</Eyebrow>
                      <span className="font-mono text-[10px] tracking-wider text-zinc-300 tabular-nums dark:text-zinc-600">
                        {String(group.items.length).padStart(2, "0")}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {group.items.map((d) => (
                        <li key={d.id}>
                          <DictationRow
                            dictation={d}
                            label={rowLabel(d, templateNames)}
                            when={formatWhen(d.startedAt, group.key)}
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </motion.div>
  );
}

function DictationRow({
  dictation: d,
  label,
  when,
}: {
  dictation: TranscriptionSummary;
  label: string;
  when: string;
}) {
  const TemplateGlyph = d.templateId ? DocumentTextIcon : PencilSquareIcon;

  return (
    <Link
      href={`/dictation/${d.id}`}
      className="group flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3.5 py-3 transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:border-zinc-600"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
        <TemplateGlyph className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={clsx(
            "block truncate text-sm font-medium",
            d.voided
              ? "text-zinc-400 line-through decoration-zinc-300 dark:text-zinc-500"
              : "text-zinc-900 dark:text-zinc-100",
          )}
        >
          {label}
        </span>
        <span className="mt-0.5 block font-mono text-[11px] tracking-wide text-zinc-400 tabular-nums dark:text-zinc-500">
          {when}
        </span>
      </span>
      <StatusBadge dictation={d} />
      <ChevronRightIcon className="size-4 shrink-0 text-zinc-300 transition-all group-hover:translate-x-0.5 group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400" />
    </Link>
  );
}

function StatusBadge({ dictation: d }: { dictation: TranscriptionSummary }) {
  if (d.voided) {
    return (
      <span className="font-mono text-[10px] tracking-wider text-zinc-300 uppercase dark:text-zinc-600">
        Deleted
      </span>
    );
  }
  if (d.status === "IN_PROGRESS") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
        <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
        In progress
      </span>
    );
  }
  if (d.status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/50 dark:text-red-400">
        <span className="size-1.5 rounded-full bg-red-500" />
        Failed
      </span>
    );
  }
  return (
    <span className="font-mono text-[11px] tracking-wide text-zinc-400 uppercase tabular-nums dark:text-zinc-500">
      {d.segmentCount} {d.segmentCount === 1 ? "segment" : "segments"}
    </span>
  );
}
