import { requireRole } from "@/lib/auth";
import { DEFAULT_TRANSCRIPTION_LANGUAGE } from "@/lib/transcription/languages";
import { TranscriptionLanguageForm } from "./_components/transcription-language-form";

// Per-tenant transcription defaults. Today: the language/accent Deepgram uses
// for this clinic's dictations and encounter recordings.
export default async function TranscriptionSettingsPage() {
  const session = await requireRole("tenant_admin", "super_admin");
  const language =
    session.transcriptionLanguage ?? DEFAULT_TRANSCRIPTION_LANGUAGE;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Transcription</h1>
      <p className="mt-1 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        The language and accent used to transcribe this clinic&apos;s dictations
        and consultations. Pick the one that best matches how your clinicians
        speak — matching it noticeably improves accuracy. Applies to everyone in
        the clinic.
      </p>

      <div className="mt-6">
        <TranscriptionLanguageForm initialLanguage={language} />
      </div>
    </div>
  );
}
