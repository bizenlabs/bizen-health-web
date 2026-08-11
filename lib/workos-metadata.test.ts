import { describe, expect, it } from "vitest";
import {
  orgMetadataFrom,
  orgMetadataToSession,
  type OrgMetadata,
  type OrgMetadataSource,
} from "./workos-metadata";

/**
 * Regression cover for the metadata-wipe hazard.
 *
 * WorkOS replaces an organization's `metadata` map wholesale on update, so any
 * writer that forgets a key destroys it. These tests turn "every key
 * round-trips" into a build-time guarantee rather than a convention.
 */
describe("orgMetadataFrom", () => {
  const full: OrgMetadataSource = {
    tenantSlug: "sunrise-a1b2c3",
    tenantStatus: "active",
    orgType: "clinic",
    transcriptionLanguage: "en-IN",
    billingStatus: "trialing",
    planCode: "clinic_monthly",
    billingDeadline: "2026-09-01T00:00:00Z",
  };

  it("round-trips every key a session carries", () => {
    const meta = orgMetadataFrom(full);

    expect(meta).toEqual({
      tenant_slug: "sunrise-a1b2c3",
      tenant_status: "active",
      org_type: "clinic",
      transcription_language: "en-IN",
      billing_status: "trialing",
      plan_code: "clinic_monthly",
      billing_deadline: "2026-09-01T00:00:00Z",
    });
  });

  it("survives a full session -> metadata -> session cycle", () => {
    // If a new field is added to the session but not to both helpers, this
    // fails — which is exactly the mistake that loses tenant state.
    expect(orgMetadataToSession(orgMetadataFrom(full) as OrgMetadata)).toEqual(
      full,
    );
  });

  it("preserves unrelated keys when one field changes", () => {
    const changed = orgMetadataFrom({
      ...full,
      transcriptionLanguage: "hi-IN",
    });

    expect(changed.transcription_language).toBe("hi-IN");
    expect(changed.tenant_slug).toBe("sunrise-a1b2c3");
    expect(changed.org_type).toBe("clinic");
    expect(changed.billing_status).toBe("trialing");
  });

  it("defaults tenant_status to active rather than dropping it", () => {
    // Dropping the key would leave whatever WorkOS already had; defaulting to
    // the safe value is what keeps a rename from suspending a workspace.
    const meta = orgMetadataFrom({ ...full, tenantStatus: null });

    expect(meta.tenant_status).toBe("active");
  });

  it("omits optional keys that have no value", () => {
    const meta = orgMetadataFrom({
      tenantSlug: "solo-x",
      tenantStatus: "active",
      orgType: "individual",
      transcriptionLanguage: null,
      billingStatus: null,
      planCode: null,
      billingDeadline: null,
    });

    expect(meta).toEqual({
      tenant_slug: "solo-x",
      tenant_status: "active",
      org_type: "individual",
    });
  });

  it("keeps billing keys when a non-billing field is written", () => {
    // The failure this guards: a settings action rewrites the org name and
    // silently erases billing_status, blanking the banner until the clock job
    // re-pushes it.
    const meta = orgMetadataFrom({ ...full, tenantSlug: "renamed-clinic" });

    expect(meta.billing_status).toBe("trialing");
    expect(meta.plan_code).toBe("clinic_monthly");
    expect(meta.billing_deadline).toBe("2026-09-01T00:00:00Z");
  });
});

describe("orgMetadataToSession", () => {
  it("maps an empty metadata map to all-null claims", () => {
    expect(orgMetadataToSession({})).toEqual({
      tenantSlug: null,
      tenantStatus: null,
      orgType: null,
      transcriptionLanguage: null,
      billingStatus: null,
      planCode: null,
      billingDeadline: null,
    });
  });

  it("reads the billing mirror written by core", () => {
    const session = orgMetadataToSession({
      billing_status: "past_due",
      plan_code: "solo_monthly",
      billing_deadline: "2026-08-20T10:00:00Z",
    });

    expect(session.billingStatus).toBe("past_due");
    expect(session.planCode).toBe("solo_monthly");
    expect(session.billingDeadline).toBe("2026-08-20T10:00:00Z");
  });
});
