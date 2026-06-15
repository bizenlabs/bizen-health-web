import { requireSession } from "@/lib/auth";
import { getPatient } from "@/lib/patients";
import { composePatientName } from "@/lib/patient-display";
import { listTemplates } from "@/lib/templates";
import { listMyDictations } from "@/lib/transcriptions";
import { DictationLibrary } from "./_components/dictation-library";

// The dictation library — the home of the dictation area. "New dictation"
// routes to the setup panel at /dictation/new; rows open /dictation/[id].
export default async function DictationPage() {
  await requireSession();
  const { content: dictations } = await listMyDictations({ size: 100 });

  // Map templateId → name so rows read "SOAP note", not a UUID. Retired
  // templates are included — an older dictation may still reference one.
  let templateNames: Record<string, string> = {};
  try {
    const templates = await listTemplates(true);
    templateNames = Object.fromEntries(templates.map((t) => [t.id, t.name]));
  } catch {
    templateNames = {};
  }

  // Resolve linked patients → names so rows can show who a dictation is for and
  // be filtered by patient. Deduped, fetched in parallel, best-effort per id.
  const patientIds = [
    ...new Set(
      dictations.map((d) => d.patientId).filter((id): id is string => !!id),
    ),
  ];
  const patientEntries = await Promise.all(
    patientIds.map(async (id): Promise<[string, string] | null> => {
      try {
        const p = await getPatient(id, { includeVoided: true });
        return [id, composePatientName(p.name)];
      } catch {
        return null;
      }
    }),
  );
  const patientNames = Object.fromEntries(
    patientEntries.filter((e): e is [string, string] => e !== null),
  );

  return (
    <DictationLibrary
      dictations={dictations}
      templateNames={templateNames}
      patientNames={patientNames}
    />
  );
}
