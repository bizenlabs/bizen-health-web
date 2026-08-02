"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  MagnifyingGlassIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import clsx from "clsx";
import { searchPatientsAction } from "@/app/(app)/patients/actions";
import { patientMeta } from "@/lib/patient-display";
import type { PatientSummary } from "@/lib/patients";

// A type-to-search picker for linking a patient — used on the dictation intake
// screen and in the dictation editor. Optional by design: a null value is a
// valid state, and the caller decides what "no patient" means. Results come from
// the BFF via searchPatientsAction (debounced); a blank query lists recent
// patients so the dropdown is useful before typing.

export function PatientPicker({
  value,
  onChange,
  disabled = false,
  busy = false,
  autoFocus = false,
}: {
  value: PatientSummary | null;
  onChange: (patient: PatientSummary | null) => void;
  disabled?: boolean;
  /** Show a pending state (e.g. while a link request is in flight). */
  busy?: boolean;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Debounced search whenever the dropdown is open and the query changes.
  useEffect(() => {
    if (!open) return;
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await searchPatientsAction(query);
      if (active) {
        setResults(res);
        setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query, open]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Selected state — a compact card with Change / Unlink affordances.
  if (value) {
    const meta = patientMeta(value);
    return (
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          <UserIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {value.preferredName}
          </span>
          {meta ? (
            <span className="block truncate font-mono text-[11px] tracking-wide text-zinc-400 dark:text-zinc-500">
              {meta}
            </span>
          ) : null}
        </span>
        {busy ? (
          <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
        ) : (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label="Unlink patient"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-200/60 hover:text-zinc-700 disabled:opacity-40 dark:hover:bg-zinc-700/60 dark:hover:text-zinc-200"
          >
            <XMarkIcon className="size-4" />
          </button>
        )}
      </div>
    );
  }

  // Search state.
  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          value={query}
          disabled={disabled}
          autoFocus={autoFocus}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          placeholder="Search patients by name or ID…"
          className="w-full rounded-lg border border-zinc-200 py-2 pr-3 pl-8 text-sm placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 focus:ring-zinc-900/5 focus:outline-none disabled:opacity-50 dark:border-zinc-800 dark:bg-transparent dark:focus:border-zinc-700"
        />
      </div>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {loading ? (
            <li className="px-3 py-2.5 text-sm text-zinc-400 dark:text-zinc-500">
              Searching…
            </li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-zinc-400 dark:text-zinc-500">
              {query.trim() ? "No patients found." : "No patients yet."}
            </li>
          ) : (
            results.map((p) => {
              const meta = patientMeta(p);
              return (
                <li key={p.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(p);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={clsx(
                      "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                      "hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                    )}
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      <UserIcon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {p.preferredName}
                      </span>
                      {meta ? (
                        <span className="block truncate font-mono text-[11px] tracking-wide text-zinc-400 dark:text-zinc-500">
                          {meta}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
