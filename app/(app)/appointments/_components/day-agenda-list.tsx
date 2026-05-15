import Link from "next/link";
import type { AppointmentDetail } from "@/lib/appointments";
import { formatClinicTime } from "@/lib/datetime";
import { StatusBadge } from "./status-badge";

/** The day's appointments, sorted by start time. */
export function DayAgendaList({
  appointments,
  patientNames,
  providerNames,
}: {
  appointments: AppointmentDetail[];
  patientNames: Record<string, string>;
  providerNames: Record<string, string>;
}) {
  if (appointments.length === 0) {
    return (
      <p className="mt-6 rounded-md border border-dashed border-zinc-300 px-4 py-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
        No appointments for this day.
      </p>
    );
  }

  const sorted = [...appointments].sort((a, b) =>
    a.startAt.localeCompare(b.startAt),
  );

  return (
    <ul className="mt-6 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {sorted.map((a) => (
        <li key={a.id}>
          <Link
            href={`/appointments/${a.id}`}
            className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <div className="w-20 shrink-0 font-medium tabular-nums">
              {formatClinicTime(a.startAt)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {patientNames[a.patientId] ?? "(unknown patient)"}
              </div>
              <div className="truncate text-xs text-zinc-500">
                {a.appointmentTypeName ?? "Appointment"}
                {a.providerId
                  ? ` · ${providerNames[a.providerId] ?? "Unknown provider"}`
                  : " · Unassigned"}
              </div>
            </div>
            <StatusBadge status={a.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
