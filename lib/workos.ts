import "server-only";
import { cache } from "react";
import type { NextRequest } from "next/server";
import {
  authkit,
  getSignInUrl as authkitGetSignInUrl,
  getSignUpUrl as authkitGetSignUpUrl,
  getWorkOS,
  handleAuth,
  saveSession,
  signOut as authkitSignOut,
  switchToOrganization as authkitSwitchToOrganization,
  withAuth,
} from "@workos-inc/authkit-nextjs";
import type { Invitation, OrganizationMembership } from "@workos-inc/node";

import {
  orgMetadataFrom,
  orgMetadataToSession,
  type BillingStatus,
  type OrgMetadata,
  type OrgType,
  type TenantStatus,
} from "@/lib/workos-metadata";

export { handleAuth, saveSession };
export const switchToOrganization = authkitSwitchToOrganization;

export type { BillingStatus, OrgType, TenantStatus };

export type SessionClaims = {
  userId: string;
  email: string;
  organizationId: string | null;
  role: string | null;
  roles: string[];
  permissions: string[];
  tenantSlug: string | null;
  tenantStatus: TenantStatus | null;
  orgType: OrgType | null;
  // The tenant's default transcription language/accent (Deepgram BCP-47 tag,
  // e.g. "en-IN"). Null when unset — callers fall back to the app default.
  transcriptionLanguage: string | null;
  // Billing state, mirrored into org metadata by core. Available here at zero
  // extra cost because the proxy already reads metadata on every request.
  // Display only — Spring is the write boundary.
  billingStatus: BillingStatus | null;
  planCode: string | null;
  billingDeadline: string | null;
  accessToken: string;
};

/**
 * WorkOS replaces org metadata wholesale on every update, so any writer must
 * re-pass the full record or silently drop the other keys. Rebuild it from the
 * session here and let callers override just the field they're changing.
 *
 * The implementation lives in `lib/workos-metadata.ts` so it stays free of
 * `server-only` and is covered by tests — this helper is the single point where
 * forgetting a key loses tenant state.
 */
export function orgMetadataFromSession(
  session: SessionClaims,
): Record<string, string> {
  return orgMetadataFrom(session);
}

const fetchOrgMetadata = cache(
  async (organizationId: string): Promise<OrgMetadata> => {
    const org = await getWorkOS().organizations.getOrganization(organizationId);
    return (org.metadata ?? {}) as OrgMetadata;
  },
);

// Per-request cache: select-org page + (app) layout both call this.
export const listMemberships = cache(
  async (userId: string): Promise<OrganizationMembership[]> => {
    const page = await getWorkOS().userManagement.listOrganizationMemberships({
      userId,
    });
    return page.data;
  },
);

// Memberships for an organization (everyone in this tenant). Used by
// /settings/staff. Cached per-request.
export const listOrgMembers = cache(
  async (organizationId: string): Promise<OrganizationMembership[]> => {
    const page = await getWorkOS().userManagement.listOrganizationMemberships({
      organizationId,
    });
    return page.data;
  },
);

// Pending invitations for an organization. Cached per-request.
export const listOrgInvitations = cache(
  async (organizationId: string): Promise<Invitation[]> => {
    const page = await getWorkOS().userManagement.listInvitations({
      organizationId,
    });
    return page.data;
  },
);

export async function getSession(): Promise<SessionClaims | null> {
  const info = await withAuth();
  if (!info.user) return null;
  const meta = info.organizationId
    ? await fetchOrgMetadata(info.organizationId)
    : {};
  return {
    userId: info.user.id,
    email: info.user.email,
    organizationId: info.organizationId ?? null,
    role: info.role ?? null,
    roles: info.roles ?? [],
    permissions: info.permissions ?? [],
    ...orgMetadataToSession(meta),
    accessToken: info.accessToken,
  };
}

export async function getApiToken(): Promise<string | null> {
  const info = await withAuth();
  return info.user ? info.accessToken : null;
}

// This deployment's own origin, no trailing slash. Local is localhost, each
// Vercel deployment is its own URL, etc.
function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL!.replace(/\/+$/, "");
}

// Derive the OAuth redirect URI from this deployment's own origin so we never
// depend on whichever URI WorkOS happens to mark as "default" in the dashboard.
function callbackUrl(): string {
  return `${appOrigin()}/callback`;
}

export async function getSignInUrl(opts?: {
  redirectTo?: string;
}): Promise<string> {
  return authkitGetSignInUrl({
    returnTo: opts?.redirectTo,
    redirectUri: callbackUrl(),
  });
}

export async function getSignUpUrl(opts?: {
  redirectTo?: string;
}): Promise<string> {
  return authkitGetSignUpUrl({
    returnTo: opts?.redirectTo,
    redirectUri: callbackUrl(),
  });
}

// AuthKit forwards `returnTo` to WorkOS as the logout `return_to`, which WorkOS
// requires to be an absolute URL matching a configured logout redirect for the
// environment. A relative path like "/" is rejected, and WorkOS then falls
// back to the (often unset) App Homepage URL — which surfaces as the
// `app-homepage-url-not-found` error page. Default to this deployment's own
// origin so every environment posts a valid, self-consistent URL.
export async function signOut(options?: { returnTo?: string }): Promise<void> {
  return authkitSignOut({ returnTo: options?.returnTo ?? `${appOrigin()}/` });
}

export const workos = getWorkOS();

// Used by `proxy.ts`. Wraps AuthKit's request-level helper and resolves tenant
// metadata in the same call so the proxy never imports `@workos-inc/*` directly.
export async function authenticateRequest(request: NextRequest): Promise<{
  session: SessionClaims | null;
  responseHeaders: Headers;
  authorizationUrl?: string;
}> {
  const { session, headers, authorizationUrl } = await authkit(request);
  if (!session.user) {
    return { session: null, responseHeaders: headers, authorizationUrl };
  }
  const meta = session.organizationId
    ? await fetchOrgMetadata(session.organizationId)
    : {};
  return {
    session: {
      userId: session.user.id,
      email: session.user.email,
      organizationId: session.organizationId ?? null,
      role: session.role ?? null,
      roles: session.roles ?? [],
      permissions: session.permissions ?? [],
      ...orgMetadataToSession(meta),
      accessToken: session.accessToken,
    },
    responseHeaders: headers,
    authorizationUrl,
  };
}
