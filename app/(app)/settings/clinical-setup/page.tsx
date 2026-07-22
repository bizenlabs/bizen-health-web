import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listRefItems } from "@/lib/reference-data";
import { RefDataManager } from "./_components/ref-data-manager";
import { RegisterRail } from "./_components/register-rail";
import { REGISTERS, resolveRegister } from "./_registers";

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ClinicalSetupPage({
  searchParams,
}: PageProps<"/settings/clinical-setup">) {
  await requireRole("tenant_admin", "super_admin");

  const sp = await searchParams;
  const showRetired = one(sp.includeRetired) === "true";
  const active = resolveRegister(one(sp.register));

  // Only the selected register is fetched — adding registers doesn't grow the
  // per-load cost.
  const items = await listRefItems(active.key, showRetired);

  const retiredHref = `/settings/clinical-setup?register=${active.key}${
    showRetired ? "" : "&includeRetired=true"
  }`;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Clinical setup</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        The clinical lists your clinic files against — visit types, encounter
        types and more. Each list is seeded when the workspace is created and is
        yours to curate.
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-[200px_1fr]">
        <RegisterRail registers={REGISTERS} active={active.key} />

        <section>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
                {active.title}
              </h2>
              <p className="mt-1 text-sm text-zinc-500">{active.blurb}</p>
            </div>
            <Link
              href={retiredHref}
              className="shrink-0 text-sm text-zinc-500 hover:text-zinc-700 hover:underline dark:hover:text-zinc-300"
            >
              {showRetired ? "Hide inactive" : "Show inactive"}
            </Link>
          </div>

          <RefDataManager
            registerKey={active.key}
            singular={active.singular}
            items={items}
          />
        </section>
      </div>
    </div>
  );
}
