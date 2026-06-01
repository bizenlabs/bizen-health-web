import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { getTemplate } from "@/lib/templates";
import { getTranscription } from "@/lib/transcriptions";
import { DictationEditor } from "../_components/dictation-editor";

// The unified dictation surface. Reached from the library, or with a `record`
// query param to begin recording immediately — from intake (a new session) or
// from Resume (a later sitting of an existing one). The DictationEditor handles
// both the live and editable states; this page just fetches and frames.
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

  // Any truthy `record` value opens straight into recording: intake passes
  // `1`, Resume passes a timestamp (so a repeat resume still differs). It
  // doubles as the editor key, remounting it fresh for each recording sitting.
  const recordParam = typeof sp?.record === "string" ? sp.record : null;
  const autoRecord =
    !!recordParam && dictation.status === "IN_PROGRESS" && !dictation.voided;

  // Structured segments handed to the editor so a resumed recording appends
  // to the existing transcript instead of starting blank.
  const initialSegments = dictation.segments.map((s) => ({
    sequence: s.sequence,
    speakerIndex: s.speakerIndex,
    text: s.text,
    startOffsetMs: s.startOffsetMs,
    endOffsetMs: s.endOffsetMs,
  }));

  // Resolve the template — its name labels the editor's format chip, its
  // content is the Markdown scaffold the editor shows above the transcript.
  let templateName: string | null = null;
  let templateContent: string | null = null;
  if (dictation.templateId) {
    try {
      const template = await getTemplate(dictation.templateId);
      templateName = template.name;
      templateContent = template.content;
    } catch {
      /* template retired or unavailable — fall back to free-form */
    }
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* The editor owns its own header (name, controls, timestamp) so the
          recording controls sit inline with the heading. It fills the
          remaining height. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <DictationEditor
          key={recordParam ?? "editing"}
          transcriptionId={dictation.id}
          title={dictation.title}
          startedAtLabel={new Date(dictation.startedAt).toLocaleString()}
          templateId={dictation.templateId}
          templateName={templateName}
          templateContent={templateContent}
          initialNote={dictation.noteContent}
          transcriptText={transcriptText}
          initialSegments={initialSegments}
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
