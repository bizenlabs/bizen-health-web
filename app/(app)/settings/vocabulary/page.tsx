import { requireRole } from "@/lib/auth";
import { listDictionary } from "@/lib/dictionary";
import { DictionaryManager } from "./_components/dictionary-manager";

// The custom-dictionary admin surface. Tenant-shared vocabulary that improves
// transcription recognition (Deepgram key terms) and rewrites finalised text
// ("BP" → "blood pressure"). Admin-only; clinicians consume it at record time.
export default async function DictionaryPage() {
  await requireRole("tenant_admin", "super_admin");

  // Include retired rows — the manager shows them under a "retired" toggle so a
  // term can be brought back, keeping the page a single round trip.
  const entries = await listDictionary(true);

  return <DictionaryManager entries={entries} />;
}
