"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Concept, Observation } from "@/lib/observations";
import { recordObservationAction, voidObservationAction } from "../actions";
import { OBSERVATION_INITIAL } from "./observation-action-state";

export function ObservationsPanel({
  encounterId,
  observations,
  concepts,
}: {
  encounterId: string;
  observations: Observation[];
  concepts: Concept[];
}) {
  return (
    <section className="mt-10 max-w-2xl">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
        Observations
      </h2>
      {observations.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No observations recorded.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {observations.map((o) => (
            <li
              key={o.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <div className="text-xs text-zinc-500">{o.conceptName}</div>
                <div className="font-medium">{formatValue(o)}</div>
              </div>
              <VoidObservationButton
                observationId={o.id}
                encounterId={encounterId}
              />
            </li>
          ))}
        </ul>
      )}
      <AddObservationForm encounterId={encounterId} concepts={concepts} />
    </section>
  );
}

function formatValue(o: Observation): string {
  if (o.valueNumeric !== null) {
    return o.valueUnits ? `${o.valueNumeric} ${o.valueUnits}` : o.valueNumeric;
  }
  return o.valueText ?? "";
}

function VoidObservationButton({
  observationId,
  encounterId,
}: {
  observationId: string;
  encounterId: string;
}) {
  const action = voidObservationAction.bind(null, observationId, encounterId);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Void this observation?")) e.preventDefault();
      }}
    >
      <SubmitChip danger>Void</SubmitChip>
    </form>
  );
}

function AddObservationForm({
  encounterId,
  concepts,
}: {
  encounterId: string;
  concepts: Concept[];
}) {
  const action = recordObservationAction.bind(null, encounterId);
  const [state, formAction] = useActionState(action, OBSERVATION_INITIAL);
  const [conceptId, setConceptId] = useState<string>("");

  const selected = useMemo(
    () => concepts.find((c) => c.id === conceptId) ?? null,
    [concepts, conceptId],
  );

  if (concepts.length === 0) {
    return (
      <p className="mt-3 text-xs text-zinc-500">
        No concepts configured for this tenant.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-4 rounded-md border border-dashed border-zinc-300 p-4 dark:border-zinc-700"
    >
      <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        Add observation
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="conceptId" className="block text-xs text-zinc-500">
            Concept
          </label>
          <select
            id="conceptId"
            name="conceptId"
            value={conceptId}
            onChange={(e) => setConceptId(e.target.value)}
            required
            className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
          >
            <option value="" disabled>
              — Select —
            </option>
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.units ? ` (${c.units})` : ""}
              </option>
            ))}
          </select>
        </div>

        {selected?.dataType === "NUMERIC" ? (
          <div>
            <label
              htmlFor="valueNumeric"
              className="block text-xs text-zinc-500"
            >
              Value{selected.units ? ` (${selected.units})` : ""}
            </label>
            <input
              id="valueNumeric"
              name="valueNumeric"
              type="number"
              step="any"
              required
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
            />
            <input type="hidden" name="dataType" value="NUMERIC" />
          </div>
        ) : null}

        {selected?.dataType === "TEXT" ? (
          <div className="md:col-span-2">
            <label htmlFor="valueText" className="block text-xs text-zinc-500">
              {selected.name}
            </label>
            <textarea
              id="valueText"
              name="valueText"
              rows={3}
              required
              className="mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
            />
            <input type="hidden" name="dataType" value="TEXT" />
          </div>
        ) : null}
      </div>

      {state.error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}

      <div className="mt-3 flex justify-end">
        <SubmitChip>Add</SubmitChip>
      </div>
    </form>
  );
}

function SubmitChip({
  children,
  danger = false,
}: {
  children: React.ReactNode;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  const base =
    "rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50";
  const tone = danger
    ? "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/40"
    : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900";
  return (
    <button type="submit" disabled={pending} className={`${base} ${tone}`}>
      {pending ? "…" : children}
    </button>
  );
}
