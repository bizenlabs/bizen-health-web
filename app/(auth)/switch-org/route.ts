import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth";
import { listMemberships, switchToOrganization } from "@/lib/workos";

function safeReturnTo(value: string | null | undefined): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

// Pin the active org for the current session, then redirect. Lives in a Route
// Handler (not a Server Action) so it can be invoked from a Server Component
// render — `switchToOrganization` rotates the session cookie, which is only
// allowed in a Route Handler or Server Action, not during render.
export async function GET(request: NextRequest) {
  const session = await requireSession();
  const orgId = request.nextUrl.searchParams.get("org");
  const returnTo = safeReturnTo(request.nextUrl.searchParams.get("returnTo"));

  if (!orgId) {
    return NextResponse.redirect(new URL("/select-org", request.url));
  }

  const memberships = await listMemberships(session.userId);
  const ok = memberships.some(
    (m) => m.organizationId === orgId && m.status === "active",
  );
  if (!ok) {
    return NextResponse.redirect(new URL("/select-org", request.url));
  }

  // switchToOrganization rotates the session cookie and throws NEXT_REDIRECT.
  await switchToOrganization(orgId, { returnTo });
  // Unreachable — switchToOrganization redirected.
  return NextResponse.redirect(new URL(returnTo, request.url));
}
