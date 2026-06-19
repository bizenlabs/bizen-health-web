"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Date-range filter for the usage dashboard. Works in whole days (UTC) and
// navigates with `from`/`to` instants on the query string; the server page
// reads them back.

function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

export function DateRange({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [fromDate, setFromDate] = useState(toDateInput(from));
  const [toDate, setToDate] = useState(toDateInput(to));

  function apply() {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", `${fromDate}T00:00:00Z`);
    // `to` is exclusive on the backend — push to the end of the chosen day.
    if (toDate) params.set("to", `${toDate}T23:59:59Z`);
    router.push(`/admin/usage?${params.toString()}`);
  }

  return (
    <div className="flex items-end gap-2">
      <label className="text-xs text-zinc-500">
        From
        <input
          type="date"
          value={fromDate}
          max={toDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="mt-1 block rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <label className="text-xs text-zinc-500">
        To
        <input
          type="date"
          value={toDate}
          min={fromDate}
          onChange={(e) => setToDate(e.target.value)}
          className="mt-1 block rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </label>
      <button
        type="button"
        onClick={apply}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Apply
      </button>
    </div>
  );
}
