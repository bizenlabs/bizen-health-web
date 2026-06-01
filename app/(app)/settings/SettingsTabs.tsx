"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

// Secondary navigation across the settings area. General is everyone's; the
// rest are admin-only routes (each enforces its own role server-side) and are
// only rendered into the bar when `isAdmin`.
const TABS = [
  { href: "/settings", label: "General", exact: true, adminOnly: false },
  {
    href: "/settings/reference-data",
    label: "Reference data",
    adminOnly: true,
  },
  { href: "/settings/templates", label: "Note templates", adminOnly: true },
  { href: "/settings/scheduling", label: "Scheduling", adminOnly: true },
  { href: "/settings/team", label: "Team", adminOnly: true },
];

export function SettingsTabs({
  isAdmin,
  className,
}: {
  isAdmin: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const tabs = TABS.filter((tab) => isAdmin || !tab.adminOnly);

  // Nothing to navigate between (non-admins only see General) — skip the bar.
  if (tabs.length <= 1) {
    return null;
  }

  return (
    <nav
      className={clsx(
        className,
        "flex gap-x-6 overflow-x-auto border-b border-zinc-950/10 text-sm/6 font-semibold [-ms-overflow-style:none] [scrollbar-width:none] dark:border-white/10 [&::-webkit-scrollbar]:hidden",
      )}
    >
      {tabs.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "-mb-px border-b-2 py-3 whitespace-nowrap",
              active
                ? "border-blue-500 text-zinc-950 dark:border-blue-400 dark:text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
