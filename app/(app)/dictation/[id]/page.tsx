import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import { getPatient, type PatientSummary } from "@/lib/patients";
import { detailToPatientSummary } from "@/lib/patient-display";
import { getBranding } from "@/lib/organization";
import { getTemplate } from "@/lib/templates";
import { getTranscription } from "@/lib/transcriptions";
import { DEFAULT_TRANSCRIPTION_LANGUAGE } from "@/lib/transcription/languages";
import type { OrgVarSource } from "@/lib/template-variables";
import { DictationEditor } from "../_components/dictation-editor";

// The unified dictation surface. Reached from the library, or with a `record`
// query param to begin recording immediately — from intake (a new session) or
// from Resume (a later sitting of an existing one). The DictationEditor handles
// both the live and editable states; this page just fetches and frames.
export default async function DictationDetailPage({
  params,
  searchParams,
}: PageProps<"/dictation/[id]">) {
  const session = await requireSession();
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

  // Resolve the linked patient (if any) so the editor can show + edit the link.
  // Template variables ({{patient.*}} / {{date.today}}) are filled in the editor
  // — at seed and whenever the patient is linked/changed — so a patient added
  // after the dictation started still fills them.
  let initialPatient: PatientSummary | null = null;
  if (dictation.patientId) {
    try {
      initialPatient = detailToPatientSummary(
        await getPatient(dictation.patientId, { includeVoided: true }),
      );
    } catch {
      /* patient unavailable — the editor still lets the clinician relink */
    }
  }

  // Organization branding fills {{org.*}} markers at seed time and the export
  // letterhead. Best-effort — the editor still opens if branding can't be loaded.
  let org: OrgVarSource | null = null;
  let orgHasLogo = false;
  try {
    const branding = await getBranding();
    org = {
      name: branding.effectiveDisplayName || null,
      address: branding.address,
      phone: branding.phone,
      email: branding.email,
      website: branding.website,
      tagline: branding.tagline,
      registrationNo: branding.registrationNo,
      taxId: branding.taxId,
    };
    orgHasLogo = branding.hasLogo;
  } catch {
    /* branding unavailable — org markers stay unresolved */
  }

  return (
    <div className="flex w-full flex-1 flex-col">
      {/* The editor owns its own header (name, controls, timestamp) so the
          recording controls sit inline with the heading. It fills the
          remaining height. The raw transcript is surfaced inside the editor
          via its Note/Transcript tab switch — no separate page section. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <DictationEditor
          key={recordParam ?? "editing"}
          transcriptionId={dictation.id}
          title={dictation.title}
          startedAtLabel={new Date(dictation.startedAt).toLocaleString()}
          templateId={dictation.templateId}
          templateName={templateName}
          templateContent={templateContent}
          mode={dictation.mode}
          initialPatient={initialPatient}
          initialNote={dictation.noteContent}
          transcriptText={transcriptText}
          initialSegments={initialSegments}
          voided={dictation.voided}
          autoRecord={autoRecord}
          language={
            session.transcriptionLanguage ?? DEFAULT_TRANSCRIPTION_LANGUAGE
          }
          org={org}
          orgHasLogo={orgHasLogo}
        />
      </div>
    </div>
  );
}
