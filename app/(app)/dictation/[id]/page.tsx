import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { ApiError } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { getTemplate } from "@/lib/templates";
import { getTranscription } from "@/lib/transcriptions";
import { DictationEditor } from "../_components/dictation-editor";

// The unified dictation surface. Reached from the library, or from intake with
// ?record=1 to begin recording immediately. The DictationEditor handles both
// the live and editable states; this page just fetches and frames.
export default async function DictationDetailPage({
  params,
  searchParams,
}: PageProps<"/dictation/[id]">) {
  await requireSession();
  const { id } = await params;
  const sp = await searchParams;

  let dictation;
  try {
    dictation = await getTranscription(id, { includeVoided: true });
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const transcriptText = dictation.segments.map((s) => s.text).join(" ");
  const autoRecord =
    sp?.record === "1" &&
    dictation.status === "IN_PROGRESS" &&
    !dictation.voided;

  // Resolve the template name for the editor's format chip.
  let templateName: string | null = null;
  if (dictation.templateId) {
    try {
      templateName = (await getTemplate(dictation.templateId)).name;
    } catch {
      templateName = null;
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col">
      <header className="shrink-0">
        <Link
          href="/dictation"
          className="inline-flex items-center gap-1 font-mono text-[11px] font-medium tracking-[0.15em] text-zinc-400 uppercase transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          <ChevronLeftIcon className="size-3.5" />
          Dictation
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Dictation
        </h1>
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          {new Date(dictation.startedAt).toLocaleString()}
        </p>
      </header>

      {/* The editor fills the remaining height. */}
      <div className="mt-6 flex min-h-0 flex-1 flex-col">
        <DictationEditor
          transcriptionId={dictation.id}
          templateId={dictation.templateId}
          templateName={templateName}
          initialNote={dictation.noteContent}
          transcriptText={transcriptText}
          voided={dictation.voided}
          autoRecord={autoRecord}
        />
      </div>

      {/* The immutable transcript record — kept distinct from the curated
          note. Hidden during a fresh recording (the editor shows it live). */}
      {transcriptText && !autoRecord ? (
        <section className="mt-6 shrink-0">
          <h2 className="font-mono text-[10px] font-medium tracking-[0.2em] text-zinc-400 uppercase dark:text-zinc-500">
            Raw transcript
          </h2>
          <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 text-sm leading-relaxed whitespace-pre-wrap text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
            {transcriptText}
          </div>
        </section>
      ) : null}
    </div>
  );
}
