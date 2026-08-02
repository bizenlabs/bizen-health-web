import {
  getTranscription,
  listTranscriptionsForEncounter,
} from "@/lib/transcriptions";
import { getTenantTranscriptionLanguage } from "@/lib/transcription/tenant-language";
import { TranscriptionRecorder } from "./transcription-recorder";
import { TranscriptView } from "./transcript-view";

// Encounter-detail section: the live recorder plus every saved transcription
// for this encounter. Server component — the recorder and transcript views it
// renders are the client pieces.
export async function TranscriptionPanel({
  encounterId,
}: {
  encounterId: string;
}) {
  const [summaries, language] = await Promise.all([
    listTranscriptionsForEncounter(encounterId),
    getTenantTranscriptionLanguage(),
  ]);
  // Encounters carry only a handful of transcriptions; fetch each detail so
  // the saved transcripts render in full.
  const details = await Promise.all(
    summaries.map((s) => getTranscription(s.id)),
  );

  return (
    <section className="mt-10 max-w-2xl">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
        Transcription
      </h2>
      <div className="mt-3">
        <TranscriptionRecorder encounterId={encounterId} language={language} />
      </div>
      {details.map((t) => (
        <TranscriptView key={t.id} transcription={t} />
      ))}
    </section>
  );
}
