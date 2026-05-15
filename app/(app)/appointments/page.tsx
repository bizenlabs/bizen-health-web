import Link from "next/link";
import { requireSession } from "@/lib/auth";
import {
  listAppointmentsForDay,
  type AppointmentDetail,
  type AppointmentStatus,
} from "@/lib/appointments";
import { listProviders } from "@/lib/providers";
import { getPatient, type PatientDetail } from "@/lib/patients";
import { formatClinicDate, todayClinicISODate } from "@/lib/datetime";
import { DayAgendaControls } from "./_components/day-agenda-controls";
import { DayAgendaList } from "./_components/day-agenda-list";

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function patientName(p: PatientDetail): string {
  return (
    [p.name.givenName, p.name.familyName].filter(Boolean).join(" ") ||
    "(unnamed)"
  );
}

export default async function AppointmentsPage({
  searchParams,
}: PageProps<"/appointments">) {
  await requireSession();
  const sp = await searchParams;
  const date = one(sp.date) || todayClinicISODate();
  const providerId = one(sp.providerId);
  const status = one(sp.status);

  const [appts, providers] = await Promise.all([
    listAppointmentsForDay(date, providerId || undefined),
    listProviders(),
  ]);

  const filtered: AppointmentDetail[] = status
    ? appts.filter((a) => a.status === (status as AppointmentStatus))
    : appts;

  const providerNames = Object.fromEntries(
    providers.map((p) => [p.id, p.displayName ?? p.email]),
  );

  const patientIds = [...new Set(filtered.map((a) => a.patientId))];
  const patients = await Promise.all(
    patientIds.map((id) =>
      getPatient(id, { includeVoided: true }).catch(() => null),
    ),
  );
  const patientNames: Record<string, string> = {};
  for (const p of patients) {
    if (p) patientNames[p.id] = patientName(p);
  }

  return (
    <div className="px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Appointments</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {formatClinicDate(`${date}T12:00:00+05:30`)} ·{" "}
            {filtered.length === 0
              ? "nothing booked"
              : `${filtered.length} appointment${filtered.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link
          href="/patients"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Book appointment
        </Link>
      </div>

      <DayAgendaControls
        date={date}
        providerId={providerId}
        status={status}
        providers={providers}
      />

      <DayAgendaList
        appointments={filtered}
        patientNames={patientNames}
        providerNames={providerNames}
      />

      <p className="mt-6 text-xs text-zinc-500">
        Book an appointment from a patient&apos;s page. Configure provider hours
        under{" "}
        <Link href="/settings/scheduling" className="hover:underline">
          Settings → Scheduling
        </Link>
        .
      </p>
    </div>
  );
}
