import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getPatient } from "@/lib/patients";
import { ApiError } from "@/lib/api";

export default async function PatientDetailPage({
  params,
}: PageProps<"/patients/[id]">) {
  await requireSession();
  const { id } = await params;

  let patient;
  try {
    patient = await getPatient(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const fullName = composeFullName(patient.name);

  return (
    <div className="px-6 py-10">
      <Link href="/patients" className="text-xs text-zinc-500 hover:underline">
        ← All patients
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">{fullName || "(unnamed)"}</h1>

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

        <Section title="Identifiers" className="md:col-span-2">
          {patient.identifiers.length === 0 ? (
            <p className="text-sm text-zinc-500">No identifiers attached.</p>
          ) : (
            <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {patient.identifiers.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{i.identifier}</div>
                    <div className="text-xs text-zinc-500">{i.typeName}</div>
                  </div>
                  {i.preferred ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      preferred
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Section>
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
