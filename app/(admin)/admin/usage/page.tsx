import { requireRole } from "@/lib/auth";
import { getUsageSummary, listServiceRates } from "@/lib/usage";
import { DateRange } from "./_components/date-range";
import { RateCard } from "./_components/rate-card";
import { formatMoney, formatNumber } from "./_components/format";

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

// Default window: the last 30 days, as an [from, to) instant pair. `to` is
// "now"; the date inputs show the date part.
function resolveWindow(fromParam: string, toParam: string) {
  const to = toParam || new Date().toISOString();
  const from =
    fromParam || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

export default async function UsagePage({
  searchParams,
}: PageProps<"/admin/usage">) {
  await requireRole("super_admin");

  const sp = await searchParams;
  const { from, to } = resolveWindow(one(sp.from), one(sp.to));

  const [summary, rates] = await Promise.all([
    getUsageSummary(from, to),
    listServiceRates(),
  ]);

  return (
    <div className="px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Usage &amp; cost</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            What we pay external providers, per tenant. Deepgram transcription
            today; AI services as they ship.
          </p>
        </div>
        <DateRange from={from} to={to} />
      </div>

      {/* Summary cards: grand total + per-meter (provider) spend. */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
          <div className="text-sm text-zinc-500">Total provider spend</div>
          <div className="mt-1 text-3xl font-semibold tabular-nums">
            {formatMoney(summary.totalCost, summary.currency)}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {summary.tenants.length} tenant
            {summary.tenants.length === 1 ? "" : "s"} with usage
          </div>
        </div>
        {summary.byMeter.map((m) => (
          <div
            key={`${m.provider}|${m.meter}`}
            className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
          >
            <div className="text-sm text-zinc-500">{meterLabel(m.meter)}</div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">
              {formatMoney(m.cost, m.currency)}
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              {formatNumber(m.quantity)} {unitLabel(m.unit)} ·{" "}
              {formatNumber(m.eventCount)} events
            </div>
          </div>
        ))}
      </div>

      {/* Per-tenant cost table — the core "cost to serve each tenant" view. */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
          Cost by tenant
        </h2>
        {summary.tenants.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">
            No metered usage in this window.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-left text-xs tracking-wide text-zinc-500 uppercase dark:border-zinc-800 dark:bg-zinc-900/50">
                <tr>
                  <th className="px-4 py-2 font-medium">Tenant</th>
                  <th className="px-4 py-2 font-medium">Meters</th>
                  <th className="px-4 py-2 text-right font-medium">Events</th>
                  <th className="px-4 py-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/70">
                {summary.tenants.map((t) => (
                  <tr key={t.tenantId}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-950 dark:text-white">
                        {t.tenantName}
                      </div>
                      <div className="font-mono text-xs text-zinc-400">
                        {t.tenantId}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {t.meters
                        .map(
                          (m) =>
                            `${meterLabel(m.meter)} (${formatNumber(m.quantity)} ${unitLabel(m.unit)})`,
                        )
                        .join(", ")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNumber(t.eventCount)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">
                      {formatMoney(t.totalCost, t.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Rate card — what we pay providers; editable without a redeploy. */}
      <section className="mt-10">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
          Rate card
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          What we pay each provider per unit. Editing sets a new rate from now;
          past usage keeps the price it was metered at.
        </p>
        <RateCard rates={rates} />
      </section>
    </div>
  );
}

function meterLabel(meter: string): string {
  if (meter === "DEEPGRAM_AUDIO_SECONDS") return "Deepgram audio";
  return meter;
}

function unitLabel(unit: string): string {
  switch (unit) {
    case "SECONDS":
      return "sec";
    case "TOKENS":
      return "tokens";
    case "REQUESTS":
      return "req";
    case "BYTES":
      return "bytes";
    default:
      return unit.toLowerCase();
  }
}
