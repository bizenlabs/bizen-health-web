"use server";

import { forbidden } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { listMemberships, switchToOrganization } from "@/lib/workos";

function safeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo) return "/dashboard";
  // Same-origin path: starts with single "/", not protocol-relative.
  if (!returnTo.startsWith("/") || returnTo.startsWith("//"))
    return "/dashboard";
  return returnTo;
}

// Switches the active WorkOS organization for the current session, then
// redirects to `returnTo` (or `/dashboard`). `switchToOrganization` performs
// the redirect itself; control does not return on success.
export async function switchOrgAction(
  organizationId: string,
  returnTo?: string | null,
): Promise<void> {
  const session = await requireSession();
  const memberships = await listMemberships(session.userId);
  const ok = memberships.some(
    (m) => m.organizationId === organizationId && m.status === "active",
  );
  if (!ok) forbidden();

  await switchToOrganization(organizationId, {
    returnTo: safeReturnTo(returnTo),
  });
}
