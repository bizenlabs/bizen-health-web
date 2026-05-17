import Link from "next/link";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { getTranscription } from "@/lib/transcriptions";
import { DictationNoteEditor } from "../_components/dictation-note-editor";

export default async function DictationDetailPage({
  params,
}: PageProps<"/dictation/[id]">) {
  await requireSession();
  const { id } = await params;

  let dictation;
  try {
    dictation = await getTranscription(id, { includeVoided: true });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const transcriptText = dictation.segments.map((s) => s.text).join(" ");

  return (
    <div className="px-6 py-10">
      <Link href="/dictation" className="text-xs text-zinc-500 hover:underline">
        ← Back to dictations
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Dictation</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {new Date(dictation.startedAt).toLocaleString()}
      </p>

      {dictation.voided ? (
        <div className="mt-6 max-w-2xl rounded-md border border-amber-300 bg-amber-50 p-4 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          This dictation has been deleted.
        </div>
      ) : null}

      <section className="mt-8 max-w-2xl">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Note
        </h2>
        <DictationNoteEditor
          transcriptionId={dictation.id}
          initialNote={dictation.noteContent}
          transcriptText={transcriptText}
        />
      </section>

      {transcriptText ? (
        <section className="mt-8 max-w-2xl">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
            Raw transcript
          </h2>
          <div className="mt-3 rounded-md border border-zinc-200 p-3 text-sm whitespace-pre-wrap text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
            {transcriptText}
          </div>
        </section>
      ) : null}
    </div>
  );
}
