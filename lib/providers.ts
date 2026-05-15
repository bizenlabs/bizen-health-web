import "server-only";
import { api } from "@/lib/api";

/**
 * A clinician/provider in the active tenant. The `id` is the bizen `Provider`
 * UUID — the value `appointment.providerId` and `providerAvailability.providerId`
 * reference (distinct from a WorkOS user id).
 */
export type Provider = {
  id: string;
  displayName: string | null;
  email: string;
  role: string | null;
  status: string;
};

/** Active providers in the tenant, for populating provider pickers. */
export const listProviders = () => api<Provider[]>(`/v1/providers`);
