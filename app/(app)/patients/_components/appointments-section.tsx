import Link from "next/link";
import type {
  AppointmentDetail,
  AppointmentRecurrence,
} from "@/lib/appointments";
import { formatClinicDateTime } from "@/lib/datetime";
import { StatusBadge } from "../../appointments/_components/status-badge";
import { CancelSeriesButton } from "./cancel-series-button";

const LINK_BTN =
  "rounded-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900";

function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function describeSeries(r: AppointmentRecurrence): string {
  const freq =
    r.recurInterval > 1
      ? `Every ${r.recurInterval} ${titleCase(r.frequency).toLowerCase()} cycles`
      : titleCase(r.frequency);
  const ends = r.occurrenceCount
    ? `${r.occurrenceCount} occurrences`
    : r.endDate
      ? `until ${r.endDate}`
      : "open-ended";
  return `${freq} · ${ends}`;
}

export function AppointmentsSection({
  patientId,
  appointments,
  recurrences,
  canBook,
}: {
  patientId: string;
  appointments: AppointmentDetail[];
  recurrences: AppointmentRecurrence[];
  canBook: boolean;
}) {
  const sorted = [...appointments].sort((a, b) =>
    b.startAt.localeCompare(a.startAt),
  );
  const activeSeries = recurrences.filter((r) => !r.voided);

  return (
    <section className="md:col-span-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Appointments
        </h2>
        {canBook ? (
          <div className="flex gap-2">
            <Link
              href={`/appointments/recurrences/new?patientId=${patientId}`}
              className={LINK_BTN}
            >
              + Series
            </Link>
            <Link
              href={`/appointments/new?patientId=${patientId}`}
              className={LINK_BTN}
            >
              + Book
            </Link>
          </div>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">No appointments yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {sorted.map((a) => (
            <li key={a.id}>
              <Link
                href={`/appointments/${a.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div className="min-w-0">
                  <div className="font-medium">
                    {a.appointmentTypeName ?? "Appointment"}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {formatClinicDateTime(a.startAt)}
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {activeSeries.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Recurring series
          </h3>
          <ul className="mt-2 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {activeSeries.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">From {r.startDate}</div>
                  <div className="text-xs text-zinc-500">
                    {describeSeries(r)}
                  </div>
                </div>
                {canBook ? (
                  <CancelSeriesButton
                    recurrenceId={r.id}
                    patientId={patientId}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
