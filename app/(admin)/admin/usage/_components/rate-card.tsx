"use client";

import { useState, useTransition } from "react";
import type { ServiceRate } from "@/lib/usage";
import { setServiceRateAction } from "../actions";
import { formatMoney } from "./format";

// Rate-card editor. Lists the active rate per meter with an inline-editable
// unit cost; saving sets a new rate from now (the backend supersedes the old
// one). Superseded rates are summarised as history, not edited.

export function RateCard({ rates }: { rates: ServiceRate[] }) {
  const active = rates.filter((r) => r.effectiveTo === null);
  const historyCount = rates.length - active.length;

  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900/50">
          <tr>
            <th className="px-4 py-2 font-medium">Provider</th>
            <th className="px-4 py-2 font-medium">Meter</th>
            <th className="px-4 py-2 font-medium">Unit</th>
            <th className="px-4 py-2 font-medium">Cost / unit</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
          {active.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-4 text-zinc-500">
                No rates configured.
              </td>
            </tr>
          ) : (
            active.map((rate) => <RateRow key={rate.id} rate={rate} />)
          )}
        </tbody>
      </table>
      {historyCount > 0 && (
        <div className="border-t border-zinc-100 px-4 py-2 text-xs text-zinc-400 dark:border-zinc-800/70">
          {historyCount} superseded rate{historyCount === 1 ? "" : "s"} retained
          for historical pricing.
        </div>
      )}
    </div>
  );
}

function RateRow({ rate }: { rate: ServiceRate }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(rate.unitCost));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const unitCost = Number(value);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      setError("Enter a non-negative number.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await setServiceRateAction({
        provider: rate.provider,
        meter: rate.meter,
        unit: rate.unit,
        unitCost,
        currency: rate.currency,
        description: rate.description,
      });
      if (res.ok) {
        setEditing(false);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <tr>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
        {rate.provider}
      </td>
      <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">
        {rate.meter}
      </td>
      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
        {rate.unit.toLowerCase()}
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex flex-col gap-1">
            <input
              type="number"
              step="any"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-40 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-900"
            />
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>
        ) : (
          <span className="tabular-nums">
            {formatMoney(rate.unitCost, rate.currency)}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        {editing ? (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setValue(String(rate.unitCost));
                setError(null);
              }}
              disabled={pending}
              className="rounded-md px-3 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md px-3 py-1 text-xs text-zinc-500 hover:text-zinc-700 hover:underline dark:hover:text-zinc-300"
          >
            Edit
          </button>
        )}
      </td>
    </tr>
  );
}
