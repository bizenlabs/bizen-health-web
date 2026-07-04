import "server-only";
import { getSession } from "@/lib/workos";
import { DEFAULT_TRANSCRIPTION_LANGUAGE } from "./languages";

// The active tenant's configured transcription language/accent, resolved from
// the session (WorkOS org metadata). Falls back to the app default when the
// clinic hasn't set one. Server-only — the value is handed to the client
// recorder components as a prop.
export async function getTenantTranscriptionLanguage(): Promise<string> {
  const session = await getSession();
  return session?.transcriptionLanguage ?? DEFAULT_TRANSCRIPTION_LANGUAGE;
}
