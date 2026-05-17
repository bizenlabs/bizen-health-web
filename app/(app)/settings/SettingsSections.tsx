import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/16/solid";

// Admin-only settings subsections. Each lives on its own route under
// `/settings`; this list is the hub that makes them discoverable.
const SECTIONS = [
  {
    href: "/settings/reference-data",
    title: "Reference data",
    description:
      "Visit types and other lookup lists your clinic files against.",
  },
  {
    href: "/settings/scheduling",
    title: "Scheduling",
    description:
      "Provider availability and the bookable slots patients fit into.",
  },
];

export function SettingsSections() {
  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
        Workspace
      </h2>

      <ul className="mt-3 divide-y divide-zinc-200 overflow-hidden rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
            >
              <span>
                <span className="block text-sm font-medium">
                  {section.title}
                </span>
                <span className="block text-xs text-zinc-500">
                  {section.description}
                </span>
              </span>
              <ChevronRightIcon className="size-4 shrink-0 text-zinc-400" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
