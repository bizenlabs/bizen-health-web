import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getEncounter, listEncounterTypes } from "@/lib/encounters";
import { ApiError } from "@/lib/api";
import { EncounterForm } from "../../_components/encounter-form";
import { editEncounterAction } from "../../actions";

export default async function EditEncounterPage({
  params,
}: PageProps<"/encounters/[id]/edit">) {
  await requireSession();
  const { id } = await params;

  let encounter;
  try {
    encounter = await getEncounter(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const types = await listEncounterTypes();
  const bound = editEncounterAction.bind(
    null,
    encounter.id,
    encounter.patientId,
  );

  return (
    <div className="px-6 py-10">
      <Link
        href={`/encounters/${encounter.id}`}
        className="text-xs text-zinc-500 hover:underline"
      >
        ← Back to encounter
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Edit encounter</h1>
      <EncounterForm
        mode={{
          kind: "edit",
          encounterId: encounter.id,
          patientId: encounter.patientId,
          initial: encounter,
        }}
        encounterTypes={types}
        action={bound}
        cancelHref={`/encounters/${encounter.id}`}
      />
    </div>
  );
}
