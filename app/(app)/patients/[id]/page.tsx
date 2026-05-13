import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getIdentifierTypes, getPatient } from "@/lib/patients";
import { listEncountersForPatient } from "@/lib/encounters";
import { listObservationsForPatient } from "@/lib/observations";
import { ApiError } from "@/lib/api";
import { EncountersSection } from "../_components/encounters-section";
import { LifecycleActions } from "../_components/lifecycle-actions";
import { ManageIdentifiers } from "../_components/manage-identifiers";
import { TimelineSection } from "../_components/timeline-section";

export default async function PatientDetailPage({
  params,
}: PageProps<"/patients/[id]">) {
  await requireSession();
  const { id } = await params;

  let patient;
  try {
    patient = await getPatient(id, { includeVoided: true });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }
  const identifierTypes = patient.voided ? [] : await getIdentifierTypes();
  const [encounters, observationsPage] = patient.voided
    ? [
        {
          content: [] as Awaited<
            ReturnType<typeof listEncountersForPatient>
          >["content"],
        },
        {
          content: [] as Awaited<
            ReturnType<typeof listObservationsForPatient>
          >["content"],
          totalElements: 0,
        },
      ]
    : await Promise.all([
        listEncountersForPatient(patient.id, { size: 20 }),
        listObservationsForPatient(patient.id, { size: 50 }),
      ]);
  const encountersById = Object.fromEntries(
    encounters.content.map((e) => [e.id, e]),
  );
  const observationsTruncated =
    observationsPage.totalElements > observationsPage.content.length;

  const fullName = composeFullName(patient.name);

  return (
    <div className="px-6 py-10">
      <Link href="/patients" className="text-xs text-zinc-500 hover:underline">
        ← All patients
      </Link>
      <div className="mt-2 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">{fullName || "(unnamed)"}</h1>
        {patient.voided ? null : (
          <Link
            href={`/patients/${patient.id}/edit`}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Edit
          </Link>
        )}
      </div>

      <div className="mt-6">
        <LifecycleActions patient={patient} />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-2">
        <Section title="Demographics">
          <DescRow label="Gender" value={patient.demographics.gender} />
          <DescRow
            label="Date of birth"
            value={formatDob(patient.demographics)}
          />
          {patient.demographics.dead ? (
            <>
              <DescRow
                label="Death date"
                value={
                  patient.deathDate
                    ? new Date(patient.deathDate).toLocaleDateString()
                    : null
                }
              />
              <DescRow label="Cause of death" value={patient.causeOfDeath} />
            </>
          ) : null}
          <DescRow label="Allergy status" value={patient.allergyStatus} />
        </Section>

        <Section title="Address">
          {Object.values(patient.address).every((v) => !v) ? (
            <p className="text-sm text-zinc-500">No address recorded.</p>
          ) : (
            <>
              <DescRow label="Line 1" value={patient.address.address1} />
              <DescRow label="Line 2" value={patient.address.address2} />
              <DescRow label="Line 3" value={patient.address.address3} />
              <DescRow
                label="City / village"
                value={patient.address.cityVillage}
              />
              <DescRow
                label="District"
                value={patient.address.countyDistrict}
              />
              <DescRow
                label="State / province"
                value={patient.address.stateProvince}
              />
              <DescRow label="Country" value={patient.address.country} />
              <DescRow label="Postal code" value={patient.address.postalCode} />
            </>
          )}
        </Section>

        {patient.voided ? null : (
          <Section title="Identifiers" className="md:col-span-2">
            <ManageIdentifiers
              patient={patient}
              identifierTypes={identifierTypes}
            />
          </Section>
        )}

        <EncountersSection
          patientId={patient.id}
          encounters={encounters.content}
          canRecord={!patient.voided}
        />

        {patient.voided ? null : (
          <TimelineSection
            observations={observationsPage.content}
            encountersById={encountersById}
            truncated={observationsTruncated}
          />
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
        {title}
      </h2>
      <dl className="mt-3 space-y-1">{children}</dl>
    </section>
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
    <div className="flex gap-3 text-sm">
      <dt className="w-32 shrink-0 text-zinc-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function composeFullName(n: {
  prefix: string | null;
  givenName: string | null;
  middleName: string | null;
  familyName: string | null;
}): string {
  return [n.prefix, n.givenName, n.middleName, n.familyName]
    .filter(Boolean)
    .join(" ");
}

function formatDob(d: {
  birthdate: string | null;
  birthdateEstimated: boolean;
}): string | null {
  if (!d.birthdate) return null;
  if (d.birthdateEstimated) {
    const year = Number(d.birthdate.slice(0, 4));
    const age = new Date().getFullYear() - year;
    return `~${age}y (estimated)`;
  }
  return d.birthdate;
}
