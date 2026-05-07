"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { listOrgMembers, workos } from "@/lib/workos";

const VALID_ROLES = new Set(["tenant_admin", "clinician", "receptionist"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function inviteMemberAction(
  email: string,
  roleSlug: string,
): Promise<void> {
  const session = await requireRole("tenant_admin");
  if (!session.organizationId) throw new Error("No active organization");

  const trimmedEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmedEmail)) throw new Error("Invalid email address");
  if (!VALID_ROLES.has(roleSlug)) throw new Error("Invalid role");

  // First invite from a solo (individual) org converts it to a team account.
  // Idempotent: if two invites race, both write the same value.
  if (session.orgType === "individual") {
    await workos.organizations.updateOrganization({
      organization: session.organizationId,
      metadata: {
        tenant_slug: session.tenantSlug ?? "",
        tenant_status: session.tenantStatus ?? "active",
        org_type: "clinic",
      },
    });
  }

  await workos.userManagement.sendInvitation({
    email: trimmedEmail,
    organizationId: session.organizationId,
    roleSlug,
    inviterUserId: session.userId,
  });

  revalidatePath("/settings/team");
}

export async function revokeInvitationAction(
  invitationId: string,
): Promise<void> {
  await requireRole("tenant_admin");
  if (!invitationId) throw new Error("Invitation id required");
  await workos.userManagement.revokeInvitation(invitationId);
  revalidatePath("/settings/team");
}

export async function removeMemberAction(membershipId: string): Promise<void> {
  const session = await requireRole("tenant_admin");
  if (!membershipId) throw new Error("Membership id required");
  if (!session.organizationId) throw new Error("No active organization");

  // Refuse to remove the last tenant_admin (FE best-effort; BE must enforce).
  const members = await listOrgMembers(session.organizationId);
  const target = members.find((m) => m.id === membershipId);
  if (!target) throw new Error("Membership not found");
  if (target.role.slug === "tenant_admin") {
    const otherActiveAdmins = members.filter(
      (m) =>
        m.id !== membershipId &&
        m.status === "active" &&
        m.role.slug === "tenant_admin",
    );
    if (otherActiveAdmins.length === 0) {
      throw new Error("Cannot remove the last admin");
    }
  }

  await workos.userManagement.deleteOrganizationMembership(membershipId);
  revalidatePath("/settings/team");
}
