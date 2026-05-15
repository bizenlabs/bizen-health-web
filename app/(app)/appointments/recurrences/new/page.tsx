import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { listAppointmentTypes } from "@/lib/appointments";
import { listProviders } from "@/lib/providers";
import { getPatient } from "@/lib/patients";
import { ApiError } from "@/lib/api";
import { RecurrenceForm } from "../../_components/recurrence-form";

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function NewRecurrencePage({
  searchParams,
}: PageProps<"/appointments/recurrences/new">) {
  await requireSession();
  const sp = await searchParams;
  const patientId = one(sp.patientId);

  if (!patientId) {
    return (
      <div className="px-6 py-10">
        <h1 className="text-2xl font-semibold">New recurring series</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Choose a patient to create a recurring series for.
        </p>
        <Link
          href="/patients"
          className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Choose a patient
        </Link>
      </div>
    );
  }

  let patient;
  try {
    patient = await getPatient(patientId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [types, providers] = await Promise.all([
    listAppointmentTypes(),
    listProviders(),
  ]);
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
      <h1 className="mt-2 text-2xl font-semibold">New recurring series</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        For <span className="font-medium">{fullName}</span> — this books one
        appointment per occurrence.
      </p>
      <RecurrenceForm
        patientId={patient.id}
        patientName={fullName}
        appointmentTypes={types}
        providers={providers}
        cancelHref={`/patients/${patient.id}`}
      />
    </div>
  );
}
