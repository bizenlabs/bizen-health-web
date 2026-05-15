import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getAppointment } from "@/lib/appointments";
import { listProviders } from "@/lib/providers";
import { getPatient } from "@/lib/patients";
import { ApiError } from "@/lib/api";
import { formatClinicDateTime } from "@/lib/datetime";
import { restoreAppointmentAction } from "../actions";
import { LifecycleActionBar } from "../_components/lifecycle-action-bar";
import { StatusBadge } from "../_components/status-badge";
import { VoidAppointmentForm } from "../_components/void-appointment-form";

export default async function AppointmentDetailPage({
  params,
}: PageProps<"/appointments/[id]">) {
  await requireSession();
  const { id } = await params;

  let appt;
  try {
    appt = await getAppointment(id, { includeVoided: true });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const patient = await getPatient(appt.patientId, { includeVoided: true });
  const providers = await listProviders();
  const patientName =
    [patient.name.givenName, patient.name.familyName]
      .filter(Boolean)
      .join(" ") || "(unnamed)";
  const providerName = appt.providerId
    ? (providers.find((p) => p.id === appt.providerId)?.displayName ??
      "Unknown provider")
    : "Unassigned";

  const editable = !appt.voided && appt.status === "SCHEDULED";
  const restore = restoreAppointmentAction.bind(null, appt.id);

  return (
    <div className="px-6 py-10">
      <Link
        href={`/patients/${appt.patientId}`}
        className="text-xs text-zinc-500 hover:underline"
      >
        ← Back to {patientName}
      </Link>
      <div className="mt-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">
            {appt.appointmentTypeName ?? "Appointment"}
          </h1>
          <StatusBadge status={appt.status} />
        </div>
        {editable ? (
          <Link
            href={`/appointments/${appt.id}/edit`}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Reschedule
          </Link>
        ) : null}
      </div>

      {appt.voided ? (
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                This appointment is voided
              </h2>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                Voided appointments are hidden from the agenda.
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
        <DescRow label="Patient" value={patientName} />
        <DescRow
          label="When"
          value={`${formatClinicDateTime(appt.startAt)} – ${formatClinicDateTime(appt.endAt)}`}
        />
        <DescRow label="Provider" value={providerName} />
        <DescRow
          label="Kind"
          value={appt.kind === "WALK_IN" ? "Walk-in" : "Scheduled"}
        />
        <DescRow label="Location" value={appt.location} />
        <DescRow label="Reason" value={appt.reason} />
        <DescRow
          label="Checked in"
          value={
            appt.checkedInAt ? formatClinicDateTime(appt.checkedInAt) : null
          }
        />
        <DescRow
          label="Completed"
          value={
            appt.completedAt ? formatClinicDateTime(appt.completedAt) : null
          }
        />
        <DescRow label="Cancel reason" value={appt.cancelReason} />
        {appt.recurrenceId ? (
          <DescRow label="Series" value="Part of a recurring series" />
        ) : null}
        {appt.fulfillingEncounterId ? (
          <div className="flex gap-3">
            <dt className="w-32 shrink-0 text-zinc-500">Encounter</dt>
            <dd>
              <Link
                href={`/encounters/${appt.fulfillingEncounterId}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                View fulfilling encounter
              </Link>
            </dd>
          </div>
        ) : null}
        {appt.notes ? (
          <div>
            <dt className="text-xs tracking-wide text-zinc-500 uppercase">
              Notes
            </dt>
            <dd className="mt-1 rounded-md border border-zinc-200 p-3 whitespace-pre-wrap dark:border-zinc-800">
              {appt.notes}
            </dd>
          </div>
        ) : null}
      </dl>

      {appt.voided ? null : (
        <LifecycleActionBar appointmentId={appt.id} status={appt.status} />
      )}

      {appt.voided ? null : <VoidAppointmentForm appointmentId={appt.id} />}
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
