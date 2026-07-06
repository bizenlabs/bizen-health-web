"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import {
  type BrandingProfileInput,
  deleteLogo,
  updateBranding,
  uploadLogo,
} from "@/lib/organization";

// Server Actions can bypass the proxy matcher, so re-verify the role here — the
// FE tab visibility is UX-only; core enforces it independently too.

export async function updateBrandingAction(
  input: BrandingProfileInput,
): Promise<void> {
  await requireRole("tenant_admin", "super_admin");
  await updateBranding(input);
  revalidatePath("/settings/organization");
}

export async function uploadLogoAction(formData: FormData): Promise<void> {
  await requireRole("tenant_admin", "super_admin");
  const file = formData.get("file");
  if (!(file instanceof Blob) || file.size === 0) {
    throw new Error("No logo file provided");
  }
  await uploadLogo(file);
  revalidatePath("/settings/organization");
}

export async function deleteLogoAction(): Promise<void> {
  await requireRole("tenant_admin", "super_admin");
  await deleteLogo();
  revalidatePath("/settings/organization");
}
