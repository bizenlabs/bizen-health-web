"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import clsx from "clsx";
import type { RegisterKey } from "@/lib/reference-data";
import { Select } from "@/components/catalyst/select";
import type { Register } from "../_registers";

/**
 * In-page navigation between reference-data registers. The active register is
 * server-resolved and passed in so the first paint highlights correctly; the
 * `includeRetired` flag is read from the URL so switching registers preserves
 * the show/hide-retired state.
 *
 * Desktop: a vertical rail (a filled active row — deliberately distinct from
 * the underline tab bar above). Mobile: a Select picker that navigates onChange.
 */
export function RegisterRail({
  registers,
  active,
}: {
  registers: Register[];
  active: RegisterKey;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showRetired = searchParams.get("includeRetired") === "true";

  const hrefFor = (key: RegisterKey) =>
    `/settings/clinical-setup?register=${key}${
      showRetired ? "&includeRetired=true" : ""
    }`;

  return (
    <>
      {/* Mobile: dropdown picker */}
      <div className="md:hidden">
        <Select
          aria-label="Register"
          value={active}
          onChange={(e) => router.push(hrefFor(e.target.value as RegisterKey))}
        >
          {registers.map((register) => (
            <option key={register.key} value={register.key}>
              {register.title}
            </option>
          ))}
        </Select>
      </div>

      {/* Desktop: vertical rail */}
      <nav className="hidden md:flex md:flex-col md:gap-1">
        {registers.map((register) => {
          const isActive = register.key === active;
          return (
            <Link
              key={register.key}
              href={hrefFor(register.key)}
              aria-current={isActive ? "page" : undefined}
              className={clsx(
                "rounded-md border-l-2 px-3 py-2 text-sm",
                isActive
                  ? "border-blue-500 bg-zinc-100 font-medium text-zinc-950 dark:bg-zinc-800 dark:text-white"
                  : "border-transparent text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
              )}
            >
              {register.title}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
