"use client";

import { useRouter } from "next/navigation";
import type { Provider } from "@/lib/providers";

/** Navigates to `?providerId=` so the page can load that provider's schedule. */
export function ProviderSelect({
  providers,
  selected,
}: {
  providers: Provider[];
  selected: string;
}) {
  const router = useRouter();
  return (
    <select
      value={selected}
      onChange={(e) =>
        router.push(
          e.target.value
            ? `/settings/scheduling?providerId=${e.target.value}`
            : "/settings/scheduling",
        )
      }
      className="rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent"
    >
      <option value="">— Select a provider —</option>
      {providers.map((p) => (
        <option key={p.id} value={p.id}>
          {p.displayName ?? p.email}
        </option>
      ))}
    </select>
  );
}
