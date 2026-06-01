import Link from "next/link";
import { requireRole } from "@/lib/auth";
import {
  listRefItems,
  type RefItem,
  type RegisterKey,
} from "@/lib/reference-data";
import { RefDataManager } from "./_components/ref-data-manager";

type Register = {
  key: RegisterKey;
  title: string;
  singular: string;
  blurb: string;
};

const REGISTERS: Register[] = [
  {
    key: "visit-types",
    title: "Visit types",
    singular: "visit type",
    blurb: "Why a patient came in — chosen once, when a visit is opened.",
  },
  {
    key: "encounter-types",
    title: "Encounter types",
    singular: "encounter type",
    blurb: "The kind of clinical interaction recorded inside a visit.",
  },
];

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function ReferenceDataPage({
  searchParams,
}: PageProps<"/settings/reference-data">) {
  await requireRole("tenant_admin", "super_admin");

  const showRetired = one((await searchParams).includeRetired) === "true";
  const items = await Promise.all(
    REGISTERS.map((register) => listRefItems(register.key, showRetired)),
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold">Reference data</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        The lookup lists your clinic files against. Each list is seeded when the
        workspace is created and is yours to curate.
      </p>

      <div className="mt-4 flex justify-end">
        <Link
          href={
            showRetired
              ? "/settings/reference-data"
              : "/settings/reference-data?includeRetired=true"
          }
          className="text-sm text-zinc-500 hover:text-zinc-700 hover:underline dark:hover:text-zinc-300"
        >
          {showRetired ? "Hide retired" : "Show retired"}
        </Link>
      </div>

      {REGISTERS.map((register, index) => (
        <RegisterSection
          key={register.key}
          register={register}
          items={items[index]}
        />
      ))}
    </div>
  );
}

function RegisterSection({
  register,
  items,
}: {
  register: Register;
  items: RefItem[];
}) {
  return (
    <section className="mt-10 first-of-type:mt-8">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
        {register.title}
      </h2>
      <p className="mt-1 text-sm text-zinc-500">{register.blurb}</p>

      <RefDataManager
        registerKey={register.key}
        singular={register.singular}
        items={items}
      />
    </section>
  );
}
