import Link from "next/link";
import type { TranscriptionSummary } from "@/lib/transcriptions";

function dictationLabel(d: TranscriptionSummary): string {
  if (d.title) return d.title;
  return d.templateId ? "Template dictation" : "Free-form dictation";
}

function statusHint(d: TranscriptionSummary): string {
  if (d.status === "IN_PROGRESS") return "In progress";
  if (d.status === "FAILED") return "Failed";
  return `${d.segmentCount} ${d.segmentCount === 1 ? "segment" : "segments"}`;
}

export function DictationsSection({
  dictations,
}: {
  dictations: TranscriptionSummary[];
}) {
  return (
    <section className="md:col-span-2">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
        Dictations
      </h2>
      {dictations.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          No dictations linked to this patient.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {dictations.map((d) => (
            <li key={d.id}>
              <Link
                href={`/dictation/${d.id}`}
                className="flex items-baseline justify-between gap-4 px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {dictationLabel(d)}
                  </div>
                  <div className="text-xs text-zinc-500">{statusHint(d)}</div>
                </div>
                <div className="shrink-0 text-xs text-zinc-500">
                  {new Date(d.startedAt).toLocaleDateString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
