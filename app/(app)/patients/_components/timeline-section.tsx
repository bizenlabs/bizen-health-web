import Link from "next/link";
import type { EncounterDetail } from "@/lib/encounters";
import type { Observation } from "@/lib/observations";

type EncounterMeta = Pick<
  EncounterDetail,
  "id" | "encounterTypeName" | "encounterDatetime"
>;

export function TimelineSection({
  observations,
  encountersById,
  truncated,
}: {
  observations: Observation[];
  encountersById: Record<string, EncounterMeta>;
  truncated: boolean;
}) {
  const groups = groupByEncounter(observations);

  return (
    <section className="md:col-span-2">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
        Timeline
      </h2>
      {groups.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          No observations recorded yet.
        </p>
      ) : (
        <ol className="mt-3 space-y-6">
          {groups.map((g) => {
            const encounter = encountersById[g.encounterId];
            const heading = encounter
              ? `${encounter.encounterTypeName ?? "Encounter"} • ${new Date(encounter.encounterDatetime).toLocaleDateString()}`
              : new Date(g.observations[0].observedAt).toLocaleDateString();
            return (
              <li
                key={g.encounterId}
                className="border-l-2 border-zinc-200 pl-4 dark:border-zinc-800"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-sm font-semibold">{heading}</h3>
                  <Link
                    href={`/encounters/${g.encounterId}`}
                    className="text-xs text-zinc-500 hover:underline"
                  >
                    View encounter →
                  </Link>
                </div>
                <ul className="mt-2 space-y-1 text-sm">
                  {g.observations.map((o) => (
                    <li key={o.id} className="flex gap-3">
                      <span className="w-40 shrink-0 text-zinc-500">
                        {o.conceptName ?? "—"}
                      </span>
                      <span className="font-medium">{formatValue(o)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
      {truncated ? (
        <p className="mt-4 text-xs text-zinc-500">
          Showing the most recent observations. Older entries are not displayed
          here yet.
        </p>
      ) : null}
    </section>
  );
}

function formatValue(o: Observation): string {
  if (o.valueNumeric !== null) {
    return o.valueUnits ? `${o.valueNumeric} ${o.valueUnits}` : o.valueNumeric;
  }
  if (o.valueCode !== null) {
    const system = o.valueCodeSystem ? `${o.valueCodeSystem} ` : "";
    const display = o.valueCodeDisplay ? ` — ${o.valueCodeDisplay}` : "";
    return `${system}${o.valueCode}${display}`;
  }
  return o.valueText ?? "";
}

function groupByEncounter(
  observations: Observation[],
): { encounterId: string; observations: Observation[] }[] {
  // Observations arrive newest-first across encounters. Group consecutive
  // entries that share an encounter so the same encounter isn't split across
  // multiple groups if its obs are interleaved chronologically.
  const groups: { encounterId: string; observations: Observation[] }[] = [];
  const byEncounter = new Map<string, Observation[]>();
  const order: string[] = [];
  for (const o of observations) {
    if (!byEncounter.has(o.encounterId)) {
      byEncounter.set(o.encounterId, []);
      order.push(o.encounterId);
    }
    byEncounter.get(o.encounterId)!.push(o);
  }
  for (const id of order) {
    groups.push({ encounterId: id, observations: byEncounter.get(id)! });
  }
  return groups;
}
