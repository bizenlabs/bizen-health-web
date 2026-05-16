"use server";

import { revalidatePath } from "next/cache";
import { ApiError, UnauthorizedError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import {
  changeTenantUserRole,
  inviteTenantUser,
  removeTenantUser,
} from "@/lib/users";
import { workos } from "@/lib/workos";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Server Action result. Actions return failures instead of throwing so the
 * user-facing message survives Next.js's production error redaction, and the
 * calling client component can render it inline.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Run an action's WorkOS/core calls, converting an expected API failure
 * (validation, conflict, last-admin, role-not-assignable) into a returned
 * error. An expired session (401) is rethrown so the error boundary can
 * bounce to sign-in.
 */
async function run(work: () => Promise<void>): Promise<ActionResult> {
  try {
    await work();
    return { ok: true };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    if (err instanceof ApiError) return { ok: false, error: err.message };
    return {
      ok: false,
      error:
        err instanceof Error && err.message
          ? err.message
          : "Something went wrong",
    };
  }
}

export async function inviteMemberAction(
  email: string,
  roleSlug: string,
): Promise<ActionResult> {
  const session = await requireRole("tenant_admin");
  if (!session.organizationId) {
    return { ok: false, error: "No active organization" };
  }
  const orgId = session.organizationId;
  const trimmedEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmedEmail)) {
    return { ok: false, error: "Enter a valid email address" };
  }

  return run(async () => {
    // First invite from a solo (individual) org converts it to a team
    // account. Org metadata is WorkOS-native — it has no core-domain object —
    // so this stays a direct WorkOS write; the membership invite goes via core.
    if (session.orgType === "individual") {
      await workos.organizations.updateOrganization({
        organization: orgId,
        metadata: {
          tenant_slug: session.tenantSlug ?? "",
          tenant_status: session.tenantStatus ?? "active",
          org_type: "clinic",
        },
      });
    }
    await inviteTenantUser(trimmedEmail, roleSlug);
    // Pending invitations are read live from WorkOS, so this refresh shows
    // the new one immediately.
    revalidatePath("/settings/team");
  });
}

export async function changeMemberRoleAction(
  providerId: string,
  roleSlug: string,
): Promise<ActionResult> {
  await requireRole("tenant_admin");
  if (!providerId) {
    return { ok: false, error: "Provider id required" };
  }
  // No revalidatePath: core's providers mirror reconciles from WorkOS via
  // webhook, so an immediate refetch would race a stale read. The client
  // applies the change optimistically instead.
  return run(() => changeTenantUserRole(providerId, roleSlug));
}

export async function removeMemberAction(
  providerId: string,
): Promise<ActionResult> {
  await requireRole("tenant_admin");
  if (!providerId) {
    return { ok: false, error: "Provider id required" };
  }
  return run(() => removeTenantUser(providerId));
}

export async function revokeInvitationAction(
  invitationId: string,
): Promise<ActionResult> {
  await requireRole("tenant_admin");
  if (!invitationId) {
    return { ok: false, error: "Invitation id required" };
  }
  return run(async () => {
    await workos.userManagement.revokeInvitation(invitationId);
    revalidatePath("/settings/team");
  });
}
