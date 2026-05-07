import "server-only";
import { cache } from "react";
import type { NextRequest } from "next/server";
import {
  authkit,
  getSignInUrl as authkitGetSignInUrl,
  getWorkOS,
  handleAuth,
  signOut as authkitSignOut,
  switchToOrganization as authkitSwitchToOrganization,
  withAuth,
} from "@workos-inc/authkit-nextjs";
import type { OrganizationMembership } from "@workos-inc/node";

export { handleAuth };
export const switchToOrganization = authkitSwitchToOrganization;

export type TenantStatus = "active" | "suspended" | "terminated";

export type SessionClaims = {
  userId: string;
  email: string;
  organizationId: string | null;
  role: string | null;
  roles: string[];
  permissions: string[];
  tenantSlug: string | null;
  tenantStatus: TenantStatus | null;
  accessToken: string;
};

type OrgMetadata = {
  tenant_slug?: string;
  tenant_status?: TenantStatus;
};

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
    tenantSlug: meta.tenant_slug ?? null,
    tenantStatus: meta.tenant_status ?? null,
    accessToken: info.accessToken,
  };
}

export async function getApiToken(): Promise<string | null> {
  const info = await withAuth();
  return info.user ? info.accessToken : null;
}

export async function getSignInUrl(opts?: {
  redirectTo?: string;
}): Promise<string> {
  return authkitGetSignInUrl({ returnTo: opts?.redirectTo });
}

export const signOut = authkitSignOut;

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
      tenantSlug: meta.tenant_slug ?? null,
      tenantStatus: meta.tenant_status ?? null,
      accessToken: session.accessToken,
    },
    responseHeaders: headers,
    authorizationUrl,
  };
}
