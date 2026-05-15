"use client";

import { useRouter } from "next/navigation";
import type { Provider } from "@/lib/providers";

const STATUSES: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "CHECKED_IN", label: "Checked in" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "NO_SHOW", label: "No-show" },
];

const SELECT_CLS =
  "rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-transparent";
const STEP_CLS =
  "rounded-md border border-zinc-200 px-3 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900";

/** Date stepper + provider/status filters for the day agenda. */
export function DayAgendaControls({
  date,
  providerId,
  status,
  providers,
}: {
  date: string;
  providerId: string;
  status: string;
  providers: Provider[];
}) {
  const router = useRouter();

  function go(next: { date?: string; providerId?: string; status?: string }) {
    const params = new URLSearchParams();
    params.set("date", next.date ?? date);
    const p = next.providerId ?? providerId;
    const s = next.status ?? status;
    if (p) params.set("providerId", p);
    if (s) params.set("status", s);
    router.push(`/appointments?${params.toString()}`);
  }

  function shiftDay(delta: number) {
    const [y, m, d] = date.split("-").map(Number);
    const shifted = new Date(y, m - 1, d + delta);
    const iso = `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(
      shifted.getDate(),
    ).padStart(2, "0")}`;
    go({ date: iso });
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => shiftDay(-1)}
        className={STEP_CLS}
        aria-label="Previous day"
      >
        ←
      </button>
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && go({ date: e.target.value })}
        className={SELECT_CLS}
      />
      <button
        type="button"
        onClick={() => shiftDay(1)}
        className={STEP_CLS}
        aria-label="Next day"
      >
        →
      </button>
      <select
        value={providerId}
        onChange={(e) => go({ providerId: e.target.value })}
        className={SELECT_CLS}
      >
        <option value="">All providers</option>
        {providers.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName ?? p.email}
          </option>
        ))}
      </select>
      <select
        value={status}
        onChange={(e) => go({ status: e.target.value })}
        className={SELECT_CLS}
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
