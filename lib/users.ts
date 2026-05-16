import "server-only";
import { api } from "@/lib/api";

/**
 * A user in the active tenant, as mirrored by bizen-health-core's `providers`
 * table. `providerId` is the bizen Provider UUID — the key that role-change
 * and remove operations address (distinct from the WorkOS user id).
 *
 * Reflects the `providers` mirror, which reconciles from WorkOS via webhook:
 * a mutation may take a moment to show up on a subsequent read.
 */
export type TenantUser = {
  providerId: string;
  workosUserId: string;
  email: string;
  displayName: string | null;
  role: string | null;
  status: string;
};

/** Every user in the tenant, including deactivated ones. tenant_admin only. */
export const listTenantUsers = () => api<TenantUser[]>(`/internal/iam/users`);

/**
 * Send a WorkOS organization invitation. The user surfaces as a TenantUser
 * only once they accept (core ingests the membership webhook).
 */
export const inviteTenantUser = (email: string, role: string) =>
  api<void>(`/internal/iam/users/invitations`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  });

/** Change a user's role. Reconciles asynchronously via the WorkOS webhook. */
export const changeTenantUserRole = (providerId: string, role: string) =>
  api<void>(`/internal/iam/users/${providerId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });

/** Remove a user from the tenant. Reconciles asynchronously via the WorkOS webhook. */
export const removeTenantUser = (providerId: string) =>
  api<void>(`/internal/iam/users/${providerId}`, { method: "DELETE" });
