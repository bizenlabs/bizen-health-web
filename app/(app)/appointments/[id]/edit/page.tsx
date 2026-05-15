import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getAppointment, listAppointmentTypes } from "@/lib/appointments";
import { listProviders } from "@/lib/providers";
import { ApiError } from "@/lib/api";
import { AppointmentForm } from "../../_components/appointment-form";
import { rescheduleAppointmentAction } from "../../actions";

export default async function EditAppointmentPage({
  params,
}: PageProps<"/appointments/[id]/edit">) {
  await requireSession();
  const { id } = await params;

  let appt;
  try {
    appt = await getAppointment(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const backHref = `/appointments/${appt.id}`;

  if (appt.status !== "SCHEDULED") {
    return (
      <div className="px-6 py-10">
        <Link href={backHref} className="text-xs text-zinc-500 hover:underline">
          ← Back to appointment
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Reschedule appointment</h1>
        <p className="mt-4 max-w-2xl rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          This appointment can no longer be rescheduled — it is{" "}
          {appt.status.toLowerCase().replace("_", " ")}.
        </p>
      </div>
    );
  }

  const [types, providers] = await Promise.all([
    listAppointmentTypes(),
    listProviders(),
  ]);
  const bound = rescheduleAppointmentAction.bind(null, appt.id, appt.patientId);

  return (
    <div className="px-6 py-10">
      <Link href={backHref} className="text-xs text-zinc-500 hover:underline">
        ← Back to appointment
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Reschedule appointment</h1>
      <AppointmentForm
        mode={{
          kind: "edit",
          appointmentId: appt.id,
          patientId: appt.patientId,
          initial: appt,
        }}
        appointmentTypes={types}
        providers={providers}
        action={bound}
        cancelHref={backHref}
      />
    </div>
  );
}
