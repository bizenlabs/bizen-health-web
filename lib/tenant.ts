import "server-only";
import { headers } from "next/headers";

// Reads the active org id stamped by `proxy.ts` as `x-tenant-id`. Returns null
// on non-app routes (marketing, /select-org, /onboarding, /suspended) where
// the proxy doesn't stamp a tenant.
export async function getActiveOrgId(): Promise<string | null> {
  const h = await headers();
  return h.get("x-tenant-id");
}

export async function requireActiveOrgId(): Promise<string> {
  const id = await getActiveOrgId();
  if (!id) {
    throw new Error(
      "No active org in request context — proxy did not stamp x-tenant-id",
    );
  }
  return id;
}
