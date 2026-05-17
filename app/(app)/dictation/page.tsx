import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listMyDictations } from "@/lib/transcriptions";
import { DictationRecorder } from "./_components/dictation-recorder";

export default async function DictationPage() {
  await requireSession();
  const { content: dictations } = await listMyDictations();

  return (
    <div className="px-6 py-10">
      <h1 className="text-2xl font-semibold">Dictation</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Dictate a clinical note hands-free. Audio streams to Deepgram and is not
        stored — only the transcript.
      </p>

      <div className="mt-6 max-w-2xl">
        <DictationRecorder />
      </div>

      <section className="mt-10 max-w-2xl">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Recent dictations
        </h2>
        {dictations.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No dictations yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {dictations.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/dictation/${d.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="font-medium">
                    {new Date(d.startedAt).toLocaleString()}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {d.status === "IN_PROGRESS"
                      ? "In progress"
                      : d.status === "FAILED"
                        ? "Failed"
                        : `${d.segmentCount} segments`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
