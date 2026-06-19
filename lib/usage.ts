import "server-only";
import { api } from "@/lib/api";

/**
 * Usage & cost metering (super-admin). Mirrors the bizen-health-core usage
 * module's reporting + rate-card DTOs (/internal/admin/usage). Cross-tenant
 * spend is a platform concern — these endpoints are super-admin only, and the
 * backend aggregates across every tenant.
 *
 * Money fields arrive as JSON numbers (backend BigDecimal). They are fine for
 * display; do not use them for further precise arithmetic on the client.
 */

export type UsageUnit = "SECONDS" | "TOKENS" | "REQUESTS" | "BYTES";

/** Spend rolled up for one provider+meter. */
export type MeterCost = {
  provider: string;
  meter: string;
  unit: UsageUnit;
  eventCount: number;
  quantity: number;
  cost: number;
  currency: string;
};

/** Spend rolled up for one tenant, with its per-meter breakdown. */
export type TenantCost = {
  tenantId: string;
  tenantName: string;
  eventCount: number;
  totalCost: number;
  currency: string;
  meters: MeterCost[];
};

/** Platform-wide spend for a window. */
export type UsageSummary = {
  from: string;
  to: string;
  totalCost: number;
  currency: string;
  tenants: TenantCost[];
  byMeter: MeterCost[];
};

export type TenantUsage = {
  tenantId: string;
  tenantName: string;
  from: string;
  to: string;
  totalCost: number;
  currency: string;
  meters: MeterCost[];
};

/** A rate-card row — what we pay a provider per unit, over an effective window. */
export type ServiceRate = {
  id: string;
  provider: string;
  meter: string;
  unit: UsageUnit;
  unitCost: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  description: string | null;
};

export type SetRateInput = {
  provider: string;
  meter: string;
  unit: UsageUnit;
  unitCost: number;
  currency?: string | null;
  description?: string | null;
  effectiveFrom?: string | null;
};

function windowQuery(from?: string | null, to?: string | null): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const q = params.toString();
  return q ? `?${q}` : "";
}

export const getUsageSummary = (from?: string | null, to?: string | null) =>
  api<UsageSummary>(`/internal/admin/usage/summary${windowQuery(from, to)}`);

export const getTenantUsage = (
  tenantId: string,
  from?: string | null,
  to?: string | null,
) =>
  api<TenantUsage>(
    `/internal/admin/usage/tenants/${tenantId}${windowQuery(from, to)}`,
  );

export const listServiceRates = () =>
  api<ServiceRate[]>(`/internal/admin/usage/rates`);

export const setServiceRate = (body: SetRateInput) =>
  api<ServiceRate>(`/internal/admin/usage/rates`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
