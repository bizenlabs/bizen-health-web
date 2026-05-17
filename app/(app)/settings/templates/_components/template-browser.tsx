"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from "@heroicons/react/20/solid";
import {
  CATEGORY_LABEL,
  TEMPLATE_CATEGORIES,
  type TemplateCategory,
} from "@/lib/template-categories";
import type { TemplateSummary } from "@/lib/templates";
import { TemplateCard } from "./template-card";

const PAGE_SIZE = 12;

/** Build page numbers with gaps: [1, 2, 'gap', 5, 6, 7, 'gap', 10] */
function getPageNumbers(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "gap")[] = [1];
  if (current > 3) pages.push("gap");

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("gap");
  pages.push(total);
  return pages;
}

/**
 * The template browse surface — a filterable, paginated card grid. Layout and
 * UX are ported from the med-scribe reference app's `TemplatesPage`, rebuilt
 * on Next.js + the platform's Tailwind conventions: category and search
 * filters narrow the list client-side, retired templates are opt-in.
 */
export function TemplateBrowser({
  templates,
}: {
  templates: TemplateSummary[];
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<TemplateCategory | "">("");
  const [showRetired, setShowRetired] = useState(false);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (!showRetired && t.retired) return false;
      if (category && t.category !== category) return false;
      if (
        needle &&
        !t.name.toLowerCase().includes(needle) &&
        !(t.description ?? "").toLowerCase().includes(needle)
      ) {
        return false;
      }
      return true;
    });
  }, [templates, search, category, showRetired]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  // A filter change can shrink the list past the current page — fold back to 1.
  function onFilterChange<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Note templates</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Reusable Markdown scaffolds for clinical notes. Each tenant starts
            with editable defaults; one template per category is the default.
          </p>
        </div>
        <Link
          href="/settings/templates/new"
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <PlusIcon className="size-4" />
          New template
        </Link>
      </div>

      <div className="mt-4 border-t border-zinc-200 dark:border-zinc-800" />

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 py-4">
        <select
          value={category}
          onChange={(e) =>
            onFilterChange(setCategory)(e.target.value as TemplateCategory | "")
          }
          className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-800 dark:bg-transparent"
        >
          <option value="">All categories</option>
          {TEMPLATE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={showRetired}
            onChange={(e) => onFilterChange(setShowRetired)(e.target.checked)}
            className="rounded border-zinc-300 dark:border-zinc-700"
          />
          Show retired
        </label>

        <div className="relative ml-auto w-56">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => onFilterChange(setSearch)(e.target.value)}
            placeholder="Search templates…"
            className="w-full rounded-md border border-zinc-200 py-1.5 pr-3 pl-8 text-sm dark:border-zinc-800 dark:bg-transparent"
          />
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center text-center">
          <DocumentTextIcon className="mb-2 size-8 text-zinc-300 dark:text-zinc-600" />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No templates found
          </p>
          <p className="text-xs text-zinc-500">
            Try adjusting your filters or create a new template.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginated.map((t) => (
              <TemplateCard key={t.id} template={t} />
            ))}
          </div>

          {totalPages > 1 ? (
            <Pagination
              page={safePage}
              totalPages={totalPages}
              onPage={setPage}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
}) {
  const STEP =
    "rounded-md border border-zinc-200 px-3 py-1 text-sm text-zinc-700 enabled:hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:text-zinc-200 dark:enabled:hover:bg-zinc-900";

  return (
    <nav className="mt-8 flex items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className={STEP}
      >
        Previous
      </button>

      {getPageNumbers(page, totalPages).map((item, i) =>
        item === "gap" ? (
          <span key={`gap-${i}`} className="px-1 text-sm text-zinc-400">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPage(item)}
            aria-current={item === page ? "page" : undefined}
            className={
              "min-w-8 rounded-md px-2.5 py-1 text-sm font-medium " +
              (item === page
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800")
            }
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages}
        className={STEP}
      >
        Next
      </button>
    </nav>
  );
}
