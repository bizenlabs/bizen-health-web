"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { workos } from "@/lib/workos";

export async function updateOrgNameAction(name: string): Promise<void> {
  const session = await requireRole("tenant_admin");
  if (!session.organizationId) throw new Error("No active organization");

  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    throw new Error("Workspace name must be 2–80 characters");
  }

  // WorkOS replaces metadata wholesale on update, so re-pass current values.
  await workos.organizations.updateOrganization({
    organization: session.organizationId,
    name: trimmed,
    metadata: {
      tenant_slug: session.tenantSlug ?? "",
      tenant_status: session.tenantStatus ?? "active",
      org_type: session.orgType ?? "clinic",
    },
  });

  revalidatePath("/", "layout");
}
