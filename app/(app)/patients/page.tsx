import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listPatients, type PatientSummary } from "@/lib/patients";

export default async function PatientsPage({
  searchParams,
}: PageProps<"/patients">) {
  await requireSession();
  const sp = await searchParams;
  const rawQ = sp.q;
  const q = Array.isArray(rawQ) ? rawQ[0] : rawQ;
  const rawPage = sp.page;
  const pageParam = Array.isArray(rawPage) ? rawPage[0] : rawPage;
  const requestedPage = Math.max(0, Number(pageParam) || 0);
  const rawVoided = sp.voided;
  const voidedParam = Array.isArray(rawVoided) ? rawVoided[0] : rawVoided;
  const voidedOnly = voidedParam === "true";
  const page = await listPatients({
    page: requestedPage,
    size: 50,
    q,
    voided: voidedOnly,
  });
  const searching = !!(q && q.trim());

  const buildHref = (overrides: {
    page?: number;
    q?: string;
    voided?: boolean;
  }) => {
    const params = new URLSearchParams();
    const nextQ = overrides.q !== undefined ? overrides.q : q;
    if (nextQ && nextQ.trim()) params.set("q", nextQ.trim());
    const nextVoided =
      overrides.voided !== undefined ? overrides.voided : voidedOnly;
    if (nextVoided) params.set("voided", "true");
    const nextPage = overrides.page ?? 0;
    if (nextPage > 0) params.set("page", String(nextPage));
    const qs = params.toString();
    return qs ? `/patients?${qs}` : "/patients";
  };
  const buildPageHref = (p: number) => buildHref({ page: p });

  return (
    <div className="px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">
            {voidedOnly ? "Voided patients" : "Patients"}
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {searching
              ? page.totalElements === 0
                ? `No matches for "${q}"${voidedOnly ? " among voided" : ""}.`
                : `${page.totalElements} match${page.totalElements === 1 ? "" : "es"} for "${q}"${voidedOnly ? " among voided" : ""}`
              : page.totalElements === 0
                ? voidedOnly
                  ? "No voided patients."
                  : "No patients yet."
                : `${page.totalElements} total`}
          </p>
        </div>
        <Link
          href="/patients/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Register patient
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <form
          method="get"
          action="/patients"
          className="flex max-w-md flex-1 items-center gap-2"
        >
          {voidedOnly ? (
            <input type="hidden" name="voided" value="true" />
          ) : null}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by name or identifier"
            className="flex-1 rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
          />
          <button
            type="submit"
            className="rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            Search
          </button>
          {searching ? (
            <Link
              href={buildHref({ q: "" })}
              className="text-xs text-zinc-500 hover:underline"
            >
              Clear
            </Link>
          ) : null}
        </form>

        <div
          role="tablist"
          aria-label="Patient status"
          className="ml-auto flex items-center gap-1 rounded-md border border-zinc-200 p-1 text-xs dark:border-zinc-800"
        >
          <Link
            href={buildHref({ voided: false })}
            role="tab"
            aria-selected={!voidedOnly}
            className={
              !voidedOnly
                ? "rounded bg-zinc-900 px-2.5 py-1 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "px-2.5 py-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }
          >
            Active
          </Link>
          <Link
            href={buildHref({ voided: true })}
            role="tab"
            aria-selected={voidedOnly}
            className={
              voidedOnly
                ? "rounded bg-zinc-900 px-2.5 py-1 font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "px-2.5 py-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            }
          >
            Voided
          </Link>
        </div>
      </div>

      {voidedOnly ? (
        <p className="mt-4 max-w-2xl rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Showing patients hidden by void. Restore from the patient detail page.
        </p>
      ) : null}

      {page.content.length === 0 ? (
        searching ? (
          <div className="mt-8 text-sm text-zinc-500">
            Try a different name or identifier.
          </div>
        ) : (
          <div className="mt-12 rounded-md border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Register your first patient to get started.
            </p>
            <Link
              href="/patients/new"
              className="mt-3 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Register first patient
            </Link>
          </div>
        )
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="bg-zinc-50 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">DOB / age</th>
                  <th className="px-4 py-2">Gender</th>
                  <th className="px-4 py-2">Primary ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {page.content.map((p) => (
                  <PatientRow key={p.id} patient={p} />
                ))}
              </tbody>
            </table>
          </div>
          {page.totalPages > 1 ? (
            <nav
              aria-label="Pagination"
              className="mt-4 flex items-center justify-between text-sm"
            >
              <span className="text-zinc-500">
                Page {page.page + 1} of {page.totalPages}
              </span>
              <div className="flex items-center gap-2">
                {page.page > 0 ? (
                  <Link
                    href={buildPageHref(page.page - 1)}
                    className="rounded-md border border-zinc-200 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    ← Previous
                  </Link>
                ) : (
                  <span className="rounded-md border border-zinc-100 px-3 py-1.5 text-zinc-300 dark:border-zinc-900 dark:text-zinc-700">
                    ← Previous
                  </span>
                )}
                {page.page + 1 < page.totalPages ? (
                  <Link
                    href={buildPageHref(page.page + 1)}
                    className="rounded-md border border-zinc-200 px-3 py-1.5 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
                  >
                    Next →
                  </Link>
                ) : (
                  <span className="rounded-md border border-zinc-100 px-3 py-1.5 text-zinc-300 dark:border-zinc-900 dark:text-zinc-700">
                    Next →
                  </span>
                )}
              </div>
            </nav>
          ) : null}
        </>
      )}
    </div>
  );
}

function PatientRow({ patient }: { patient: PatientSummary }) {
  return (
    <tr className="hover:bg-zinc-50 dark:hover:bg-zinc-900">
      <td className="px-4 py-2">
        <Link
          href={`/patients/${patient.id}`}
          className="font-medium hover:underline"
        >
          {patient.preferredName}
        </Link>
      </td>
      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
        {formatBirthdate(patient)}
      </td>
      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
        {patient.gender ? capitalize(patient.gender) : "—"}
      </td>
      <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
        {patient.primaryIdentifier ? (
          <>
            <span className="text-xs text-zinc-500">
              {patient.primaryIdentifierType}
            </span>{" "}
            {patient.primaryIdentifier}
          </>
        ) : (
          "—"
        )}
      </td>
    </tr>
  );
}

function formatBirthdate(p: PatientSummary): string {
  if (!p.birthdate) return "—";
  if (p.birthdateEstimated) {
    // Birthdate set to Jan 1 of estimated-year — show as "~Ny"
    const year = Number(p.birthdate.slice(0, 4));
    const age = new Date().getFullYear() - year;
    return `~${age}y`;
  }
  return p.birthdate;
}

function capitalize(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}
