import { notFound } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getPatient } from "@/lib/patients";
import { ApiError } from "@/lib/api";
import { PatientForm } from "../../_components/patient-form";
import { updatePatientAction } from "../../actions";

export default async function EditPatientPage({
  params,
}: PageProps<"/patients/[id]/edit">) {
  await requireSession();
  const { id } = await params;

  let patient;
  try {
    patient = await getPatient(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="px-6 py-10">
      <Link
        href={`/patients/${id}`}
        className="text-xs text-zinc-500 hover:underline"
      >
        ← Back to patient
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Edit patient</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Demographics, name, and address. Identifiers are edited separately.
      </p>
      <PatientForm
        mode="edit"
        action={updatePatientAction.bind(null, id)}
        patient={patient}
      />
    </div>
  );
}
