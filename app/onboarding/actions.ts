"use server";

import { requireSession } from "@/lib/auth";
import {
  listMemberships,
  switchToOrganization,
  workos,
  type OrgType,
} from "@/lib/workos";
import { generateOrgSlug } from "@/lib/slug";

const VALID_ORG_TYPES: ReadonlySet<OrgType> = new Set(["individual", "clinic"]);

export async function createWorkspaceAction(
  orgType: OrgType,
  orgName: string,
): Promise<void> {
  const session = await requireSession();

  // Idempotency: if a prior submit (or invitation acceptance) already linked
  // the user to an org, don't create a duplicate — pin and continue.
  const existing = await listMemberships(session.userId);
  if (existing.length > 0) {
    await switchToOrganization(existing[0].organizationId, {
      returnTo: "/dashboard",
    });
    return;
  }

  const trimmed = orgName.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    throw new Error("Workspace name must be 2–80 characters");
  }
  if (!VALID_ORG_TYPES.has(orgType)) {
    throw new Error("Invalid account type");
  }

  const slug = generateOrgSlug(trimmed);
  const org = await workos.organizations.createOrganization({
    name: trimmed,
    metadata: {
      tenant_slug: slug,
      tenant_status: "active",
      org_type: orgType,
    },
  });
  await workos.userManagement.createOrganizationMembership({
    userId: session.userId,
    organizationId: org.id,
    roleSlug: "tenant_admin",
  });

  // switchToOrganization redirects; control does not return.
  await switchToOrganization(org.id, { returnTo: "/dashboard" });
}
