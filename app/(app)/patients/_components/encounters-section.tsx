import Link from "next/link";
import type { EncounterDetail } from "@/lib/encounters";

export function EncountersSection({
  patientId,
  encounters,
  canRecord,
}: {
  patientId: string;
  encounters: EncounterDetail[];
  canRecord: boolean;
}) {
  return (
    <section className="md:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Encounters
        </h2>
        {canRecord ? (
          <Link
            href={`/patients/${patientId}/encounters/new`}
            className="rounded-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            + New encounter
          </Link>
        ) : null}
      </div>
      {encounters.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No encounters yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {encounters.map((e) => (
            <li key={e.id}>
              <Link
                href={`/encounters/${e.id}`}
                className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div className="min-w-0">
                  <div className="font-medium">
                    {e.encounterTypeName ?? "Encounter"}
                  </div>
                  {e.notes ? (
                    <div className="truncate text-xs text-zinc-500">
                      {e.notes.split("\n")[0]}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 text-xs text-zinc-500">
                  {new Date(e.encounterDatetime).toLocaleDateString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
