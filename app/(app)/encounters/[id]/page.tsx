import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getEncounter } from "@/lib/encounters";
import { getPatient } from "@/lib/patients";
import { ApiError } from "@/lib/api";
import { restoreEncounterAction } from "../actions";
import { VoidEncounterForm } from "../_components/void-encounter-form";

export default async function EncounterDetailPage({
  params,
}: PageProps<"/encounters/[id]">) {
  await requireSession();
  const { id } = await params;

  let encounter;
  try {
    encounter = await getEncounter(id, { includeVoided: true });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const patient = await getPatient(encounter.patientId, {
    includeVoided: true,
  });
  const patientName =
    [patient.name.givenName, patient.name.familyName]
      .filter(Boolean)
      .join(" ") || "(unnamed)";

  const restore = restoreEncounterAction.bind(null, encounter.id);

  return (
    <div className="px-6 py-10">
      <Link
        href={`/patients/${encounter.patientId}`}
        className="text-xs text-zinc-500 hover:underline"
      >
        ← Back to {patientName}
      </Link>
      <div className="mt-2 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">
          {encounter.encounterTypeName ?? "Encounter"}
        </h1>
        {encounter.voided ? null : (
          <Link
            href={`/encounters/${encounter.id}/edit`}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Edit
          </Link>
        )}
      </div>

      {encounter.voided ? (
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                This encounter is voided
              </h2>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                Voided encounters are hidden from the patient timeline.
              </p>
            </div>
            <form action={restore}>
              <button
                type="submit"
                className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200"
              >
                Restore
              </button>
            </form>
          </div>
        </div>
      ) : null}

      <dl className="mt-8 max-w-2xl space-y-3 text-sm">
        <DescRow
          label="When"
          value={new Date(encounter.encounterDatetime).toLocaleString()}
        />
        <DescRow label="Location" value={encounter.location} />
        <DescRow label="Recorded by" value={encounter.recordedBy} />
        {encounter.notes ? (
          <div>
            <dt className="text-xs tracking-wide text-zinc-500 uppercase">
              Notes
            </dt>
            <dd className="mt-1 rounded-md border border-zinc-200 p-3 whitespace-pre-wrap dark:border-zinc-800">
              {encounter.notes}
            </dd>
          </div>
        ) : null}
      </dl>

      {encounter.voided ? null : (
        <VoidEncounterForm
          encounterId={encounter.id}
          patientId={encounter.patientId}
        />
      )}
    </div>
  );
}

function DescRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <dt className="w-32 shrink-0 text-zinc-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
