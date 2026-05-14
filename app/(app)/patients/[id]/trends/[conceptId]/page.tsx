import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getPatient } from "@/lib/patients";
import {
  listConcepts,
  listObservationsForPatientAndConcept,
} from "@/lib/observations";
import { ApiError } from "@/lib/api";
import { TrendChart } from "../../../_components/trend-chart";

export default async function TrendDetailPage({
  params,
}: PageProps<"/patients/[id]/trends/[conceptId]">) {
  await requireSession();
  const { id, conceptId } = await params;

  let patient;
  try {
    patient = await getPatient(id, { includeVoided: true });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const [concepts, observationsPage] = await Promise.all([
    listConcepts(),
    listObservationsForPatientAndConcept(id, conceptId, { size: 500 }),
  ]);
  const concept = concepts.find((c) => c.id === conceptId);
  if (!concept) notFound();

  const patientName =
    [patient.name.givenName, patient.name.familyName]
      .filter(Boolean)
      .join(" ") || "(unnamed)";

  if (concept.dataType !== "NUMERIC") {
    return (
      <div className="px-6 py-10">
        <Link
          href={`/patients/${id}`}
          className="text-xs text-zinc-500 hover:underline"
        >
          ← Back to {patientName}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{concept.name}</h1>
        <p className="mt-4 text-sm text-zinc-500">
          Trends are only available for numeric concepts.
        </p>
      </div>
    );
  }

  const points = observationsPage.content
    .map((o) => ({
      id: o.id,
      encounterId: o.encounterId,
      value: o.valueNumeric === null ? NaN : Number(o.valueNumeric),
      observedAt: o.observedAt,
    }))
    .filter((p) => Number.isFinite(p.value));

  const values = points.map((p) => p.value);
  const latest = points.length > 0 ? points[points.length - 1].value : null;
  const min = values.length > 0 ? Math.min(...values) : null;
  const max = values.length > 0 ? Math.max(...values) : null;

  return (
    <div className="px-6 py-10">
      <Link
        href={`/patients/${id}`}
        className="text-xs text-zinc-500 hover:underline"
      >
        ← Back to {patientName}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">
        {concept.name}
        {concept.units ? (
          <span className="ml-2 text-base font-normal text-zinc-500">
            ({concept.units})
          </span>
        ) : null}
      </h1>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Latest" value={formatStat(latest)} units={concept.units} />
        <Stat label="Min" value={formatStat(min)} units={concept.units} />
        <Stat label="Max" value={formatStat(max)} units={concept.units} />
        <Stat label="Readings" value={String(points.length)} units={null} />
      </div>

      <div className="mt-8 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <TrendChart points={points} units={concept.units} />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Readings
        </h2>
        {points.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No readings recorded for this concept.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {[...points].reverse().map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
              >
                <span className="text-zinc-500">
                  {new Date(p.observedAt).toLocaleString()}
                </span>
                <span className="font-medium">
                  {formatStat(p.value)}
                  {concept.units ? (
                    <span className="ml-1 text-xs text-zinc-500">
                      {concept.units}
                    </span>
                  ) : null}
                  <Link
                    href={`/encounters/${p.encounterId}`}
                    className="ml-3 text-xs text-zinc-500 hover:underline"
                  >
                    encounter →
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  units,
}: {
  label: string;
  value: string;
  units: string | null;
}) {
  return (
    <div className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">
        {value}
        {units && value !== "—" ? (
          <span className="ml-1 text-xs font-normal text-zinc-500">
            {units}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function formatStat(v: number | null): string {
  if (v === null) return "—";
  if (Number.isInteger(v)) return String(v);
  return Number(v.toFixed(2)).toString();
}
