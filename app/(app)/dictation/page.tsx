import { requireSession } from "@/lib/auth";
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

  return (
    <DictationLibrary dictations={dictations} templateNames={templateNames} />
  );
}
