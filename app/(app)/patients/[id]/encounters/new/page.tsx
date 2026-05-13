import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getPatient } from "@/lib/patients";
import { listEncounterTypes } from "@/lib/encounters";
import { ApiError } from "@/lib/api";
import { EncounterForm } from "../../../../encounters/_components/encounter-form";
import { recordEncounterAction } from "../../../../encounters/actions";

export default async function NewEncounterPage({
  params,
}: PageProps<"/patients/[id]/encounters/new">) {
  await requireSession();
  const { id } = await params;

  let patient;
  try {
    patient = await getPatient(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const types = await listEncounterTypes();

  const bound = recordEncounterAction.bind(null, patient.id);

  const fullName =
    [patient.name.givenName, patient.name.familyName]
      .filter(Boolean)
      .join(" ") || "(unnamed)";

  return (
    <div className="px-6 py-10">
      <Link
        href={`/patients/${patient.id}`}
        className="text-xs text-zinc-500 hover:underline"
      >
        ← Back to {fullName}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Record encounter</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        For <span className="font-medium">{fullName}</span>
      </p>
      <EncounterForm
        mode={{ kind: "create", patientId: patient.id }}
        encounterTypes={types}
        action={bound}
        cancelHref={`/patients/${patient.id}`}
      />
    </div>
  );
}
