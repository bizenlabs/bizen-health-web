/**
 * The shape of a WorkOS Organization's `metadata` map, and the helper that
 * round-trips it safely.
 *
 * Deliberately free of `import "server-only"` and of any `@workos-inc/*`
 * import: keeping it pure is what makes it testable under the repo's
 * node-only vitest setup, which matters because the wipe hazard below is the
 * easiest way to lose tenant state in this codebase.
 */

export type TenantStatus = "active" | "suspended" | "terminated";
export type OrgType = "individual" | "clinic";

/**
 * Billing state, mirrored here by core so the proxy and server components can
 * read it with no extra network call — the proxy already fetches org metadata
 * on every request, so these keys ride along for free.
 *
 * This is a cache, never authority. Spring decides what a tenant may actually
 * do; a stale value here can only make a banner wrong.
 */
export type BillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "read_only"
  | "cancelled";

export type OrgMetadata = {
  tenant_slug?: string;
  tenant_status?: TenantStatus;
  org_type?: OrgType;
  transcription_language?: string;
  // Written by core's billing module (see TenantMetadataMirror), read here.
  billing_status?: BillingStatus;
  plan_code?: string;
  /** ISO-8601: trial end while trialing, grace end while past due. */
  billing_deadline?: string;
};

/** The subset of session fields this module needs. */
export type OrgMetadataSource = {
  tenantSlug: string | null;
  tenantStatus: TenantStatus | null;
  orgType: OrgType | null;
  transcriptionLanguage: string | null;
  billingStatus: BillingStatus | null;
  planCode: string | null;
  billingDeadline: string | null;
};

/**
 * Rebuild the full metadata record from the session, so a caller changing one
 * field doesn't silently drop the rest.
 *
 * WorkOS replaces `metadata` wholesale on every update. Any writer that passes
 * only the key it cares about erases everything else — which in practice means
 * losing the tenant slug, the individual/clinic flag, the dictation language,
 * or the billing mirror. Every writer must start from this.
 *
 * Values are always present (as "" when unset) rather than omitted: omitting a
 * key leaves whatever was there before, and a stale trial deadline on a paid
 * account reads as a bug.
 */
export function orgMetadataFrom(
  session: OrgMetadataSource,
): Record<string, string> {
  const meta: Record<string, string> = {
    tenant_slug: session.tenantSlug ?? "",
    tenant_status: session.tenantStatus ?? "active",
    org_type: session.orgType ?? "clinic",
  };
  if (session.transcriptionLanguage) {
    meta.transcription_language = session.transcriptionLanguage;
  }
  if (session.billingStatus) meta.billing_status = session.billingStatus;
  if (session.planCode) meta.plan_code = session.planCode;
  if (session.billingDeadline) meta.billing_deadline = session.billingDeadline;
  return meta;
}

/** Project a raw metadata map onto the session fields we carry. */
export function orgMetadataToSession(meta: OrgMetadata): OrgMetadataSource {
  return {
    tenantSlug: meta.tenant_slug ?? null,
    tenantStatus: meta.tenant_status ?? null,
    orgType: meta.org_type ?? null,
    transcriptionLanguage: meta.transcription_language ?? null,
    billingStatus: meta.billing_status ?? null,
    planCode: meta.plan_code ?? null,
    billingDeadline: meta.billing_deadline ?? null,
  };
}
