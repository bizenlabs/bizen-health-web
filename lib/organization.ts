import "server-only";
import { api, apiMultipart } from "@/lib/api";

/**
 * A clinic's organization branding — the name, contacts and logo it puts on the
 * documents it produces (dictation exports today, invoices when billing lands).
 * Backed by core's {@code /v1/organization/branding}; one profile per tenant.
 *
 * {@link displayName} is what the clinic explicitly set (may be null);
 * {@link effectiveDisplayName} is what renderers should show — it falls back to
 * the tenant's registered name when no display name is set.
 */
export type OrgBranding = {
  displayName: string | null;
  effectiveDisplayName: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tagline: string | null;
  registrationNo: string | null;
  taxId: string | null;
  hasLogo: boolean;
  /** Core-side path; the browser loads the logo via the BFF proxy instead. */
  logoUrl: string | null;
};

/** The full text profile submitted by the settings form; blank = cleared. */
export type BrandingProfileInput = {
  displayName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  tagline?: string | null;
  registrationNo?: string | null;
  taxId?: string | null;
};

export const getBranding = () => api<OrgBranding>("/v1/organization/branding");

export const updateBranding = (input: BrandingProfileInput) =>
  api<OrgBranding>("/v1/organization/branding", {
    method: "PUT",
    body: JSON.stringify(input),
  });

/**
 * Upload/replace the logo. The blob should already be resized client-side —
 * core caps at 1MB and validates JPEG/PNG magic bytes.
 */
export const uploadLogo = (file: Blob) => {
  const fd = new FormData();
  fd.append("file", file);
  return apiMultipart<void>("/v1/organization/branding/logo", fd, {
    method: "PUT",
  });
};

export const deleteLogo = () =>
  api<void>("/v1/organization/branding/logo", { method: "DELETE" });
