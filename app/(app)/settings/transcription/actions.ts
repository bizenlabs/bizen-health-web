"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { orgMetadataFromSession, workos } from "@/lib/workos";
import { isSupportedTranscriptionLanguage } from "@/lib/transcription/languages";

export async function updateTranscriptionLanguageAction(
  language: string,
): Promise<void> {
  const session = await requireRole("tenant_admin", "super_admin");
  if (!session.organizationId) throw new Error("No active organization");
  if (!isSupportedTranscriptionLanguage(language)) {
    throw new Error("Unsupported transcription language");
  }

  // WorkOS replaces metadata wholesale on update; the helper re-passes the
  // current values so only the language changes.
  await workos.organizations.updateOrganization({
    organization: session.organizationId,
    metadata: {
      ...orgMetadataFromSession(session),
      transcription_language: language,
    },
  });

  revalidatePath("/", "layout");
}
