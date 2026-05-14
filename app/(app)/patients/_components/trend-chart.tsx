type Point = { value: number; observedAt: string };

export function TrendChart({
  points,
  units,
}: {
  points: Point[];
  units: string | null;
}) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No readings recorded for this concept.
      </p>
    );
  }

  const w = 560;
  const h = 240;
  const padLeft = 56;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 36;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  const values = points.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const rangeV = maxV - minV || 1;
  // pad so dots don't touch top/bottom
  const yMin = minV - rangeV * 0.08;
  const yMax = maxV + rangeV * 0.08;
  const yRange = yMax - yMin || 1;

  const times = points.map((p) => new Date(p.observedAt).getTime());
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const rangeT = maxT - minT || 1;

  const xOf = (t: number) =>
    padLeft + (points.length === 1 ? plotW / 2 : ((t - minT) / rangeT) * plotW);
  const yOf = (v: number) => padTop + (1 - (v - yMin) / yRange) * plotH;

  const polylinePoints = points
    .map(
      (p) =>
        `${xOf(new Date(p.observedAt).getTime()).toFixed(1)},${yOf(p.value).toFixed(1)}`,
    )
    .join(" ");

  const yTicks = niceTicks(minV, maxV, 5);
  const xTickCount = Math.min(points.length, 5);
  const xTicks = makeXTicks(minT, maxT, xTickCount);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      className="overflow-visible text-zinc-700 dark:text-zinc-300"
      aria-label="Trend chart"
    >
      {/* Y-axis gridlines + labels */}
      {yTicks.map((v) => {
        const y = yOf(v);
        return (
          <g key={`y-${v}`}>
            <line
              x1={padLeft}
              x2={w - padRight}
              y1={y}
              y2={y}
              className="stroke-zinc-200 dark:stroke-zinc-800"
              strokeWidth="1"
            />
            <text
              x={padLeft - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-zinc-500 text-[10px]"
            >
              {formatTick(v)}
            </text>
          </g>
        );
      })}

      {/* X-axis */}
      <line
        x1={padLeft}
        x2={w - padRight}
        y1={h - padBottom}
        y2={h - padBottom}
        className="stroke-zinc-300 dark:stroke-zinc-700"
        strokeWidth="1"
      />
      {xTicks.map((t) => (
        <text
          key={`x-${t}`}
          x={xOf(t)}
          y={h - padBottom + 16}
          textAnchor="middle"
          className="fill-zinc-500 text-[10px]"
        >
          {formatDate(t)}
        </text>
      ))}

      {/* Y-axis label */}
      {units ? (
        <text
          x={padLeft - 8}
          y={padTop - 4}
          textAnchor="end"
          className="fill-zinc-500 text-[10px]"
        >
          {units}
        </text>
      ) : null}

      {/* Data line */}
      {points.length >= 2 ? (
        <polyline
          fill="none"
          strokeWidth="1.5"
          className="stroke-emerald-500"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polylinePoints}
        />
      ) : null}

      {/* Data points */}
      {points.map((p, i) => {
        const cx = xOf(new Date(p.observedAt).getTime());
        const cy = yOf(p.value);
        const titleText = `${formatTick(p.value)}${units ? " " + units : ""} · ${new Date(p.observedAt).toLocaleString()}`;
        return (
          <circle
            key={`dot-${i}`}
            cx={cx}
            cy={cy}
            r="3.5"
            className="fill-emerald-500 stroke-white dark:stroke-zinc-950"
            strokeWidth="1.5"
          >
            <title>{titleText}</title>
          </circle>
        );
      })}
    </svg>
  );
}

function niceTicks(min: number, max: number, count: number): number[] {
  if (min === max) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

function makeXTicks(minT: number, maxT: number, count: number): number[] {
  if (count <= 1) return [minT];
  const step = (maxT - minT) / (count - 1);
  return Array.from({ length: count }, (_, i) => minT + step * i);
}

function formatTick(v: number): string {
  if (Number.isInteger(v)) return String(v);
  // 1 decimal for small ranges, 0 for big
  const abs = Math.abs(v);
  if (abs >= 100) return v.toFixed(0);
  return v.toFixed(1);
}

function formatDate(t: number): string {
  return new Date(t).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
