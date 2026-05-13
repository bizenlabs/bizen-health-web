import type { Observation } from "@/lib/observations";

type Series = {
  conceptId: string;
  conceptName: string;
  units: string | null;
  points: { value: number; observedAt: string }[];
};

export function VitalsTrendSection({
  observations,
}: {
  observations: Observation[];
}) {
  const series = buildSeries(observations);

  if (series.length === 0) {
    return null;
  }

  return (
    <section className="md:col-span-2">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
        Vitals trend
      </h2>
      <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {series.map((s) => (
          <li
            key={s.conceptId}
            className="flex items-center justify-between gap-6 px-4 py-3 text-sm"
          >
            <div className="min-w-0 shrink-0">
              <div className="text-xs text-zinc-500">{s.conceptName}</div>
              <div className="font-medium">
                {formatLatest(s)}
                {s.units ? (
                  <span className="ml-1 text-xs text-zinc-500">{s.units}</span>
                ) : null}
              </div>
              <div className="text-xs text-zinc-400">
                {s.points.length} value{s.points.length === 1 ? "" : "s"} ·{" "}
                {new Date(
                  s.points[s.points.length - 1].observedAt,
                ).toLocaleDateString()}
              </div>
            </div>
            {s.points.length >= 2 ? (
              <Sparkline series={s} />
            ) : (
              <span className="text-xs text-zinc-400">—</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatLatest(s: Series): string {
  const latest = s.points[s.points.length - 1].value;
  // Trim trailing zeros for whole/clean numbers, keep up to 2 decimals
  // otherwise. Avoids "72.500000" rendering from BigDecimal strings.
  if (Number.isInteger(latest)) return String(latest);
  return Number(latest.toFixed(2)).toString();
}

function Sparkline({ series }: { series: Series }) {
  const w = 120;
  const h = 28;
  const pad = 2;
  const values = series.points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const n = values.length;

  const points = values
    .map((v, i) => {
      const x = pad + (i / (n - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const lastX = pad + (w - pad * 2);
  const lastY = h - pad - ((values[n - 1] - min) / range) * (h - pad * 2);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      aria-label={`${series.conceptName} trend`}
      className="shrink-0 overflow-visible"
    >
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className="text-zinc-500 dark:text-zinc-400"
      />
      <circle cx={lastX} cy={lastY} r="2.5" className="fill-emerald-500" />
    </svg>
  );
}

function buildSeries(observations: Observation[]): Series[] {
  // observations arrive newest-first; reverse per-concept so the sparkline
  // reads left-to-right oldest-to-newest, which is how clinicians read trends.
  const byConcept = new Map<string, Series>();
  for (const o of observations) {
    if (o.valueNumeric === null) continue;
    const v = Number(o.valueNumeric);
    if (!Number.isFinite(v)) continue;
    const id = o.conceptId;
    let s = byConcept.get(id);
    if (!s) {
      s = {
        conceptId: id,
        conceptName: o.conceptName ?? "—",
        units: o.valueUnits,
        points: [],
      };
      byConcept.set(id, s);
    }
    s.points.push({ value: v, observedAt: o.observedAt });
  }
  const series = Array.from(byConcept.values());
  for (const s of series) {
    s.points.reverse();
  }
  // Surface concepts that have a recent reading first.
  series.sort((a, b) => {
    const aLast = a.points[a.points.length - 1].observedAt;
    const bLast = b.points[b.points.length - 1].observedAt;
    return bLast.localeCompare(aLast);
  });
  return series;
}
