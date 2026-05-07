// Next.js 16: this file is `proxy.ts`, not `middleware.ts`. The function must
// be exported as `proxy` (named or default). Edge runtime is not supported in
// proxy; runtime is Node and not configurable.
//
// Auth integration: AuthKit v4 (@workos-inc/authkit-nextjs) ships an
// `authkitProxy` helper, but we use the lower-level `authkit(request)` (via
// `lib/workos#authenticateRequest`) so we can layer our own tenant gate on top.
// The AuthKit response headers are merged into our final response so session
// cookies refresh as expected.
//
// Tenancy is stateless: the active WorkOS Organization is pinned in the session
// (`session.organizationId`), never in the URL. Users with no pinned org are
// bounced to `/select-org`; users with multiple memberships switch via the
// `switchOrgAction` Server Action (see `app/select-org/actions.ts`).
//
// Defense in depth: this proxy is "optimistic" per Next 16 docs. The real
// boundary is Spring Boot, which re-validates the JWT against JWKS and enforces
// tenant isolation at the data layer. Server Actions must also call
// `requireSession()` / `requireRole()` themselves — proxy matchers can silently
// miss them after refactors.

import { NextResponse, type NextRequest } from "next/server";
import { authenticateRequest } from "@/lib/workos";

// Paths that don't require an authenticated, org-pinned session. Everything
// else is treated as part of the authenticated app.
const PUBLIC_PATHS = new Set([
  "/",
  "/sign-in",
  "/sign-up",
  "/sign-out",
  "/callback",
  "/switch-org",
  "/forbidden",
  "/not-found",
  "/select-org",
  "/onboarding",
  "/suspended",
]);

function buildSignInUrl(request: NextRequest, redirectTo: string) {
  const url = new URL("/sign-in", request.url);
  url.searchParams.set("redirect_url", redirectTo);
  return url;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const { session, responseHeaders } = await authenticateRequest(request);

  // Merge AuthKit's response headers (session refresh cookies, etc.) into
  // whatever response we ultimately return.
  const withAuthHeaders = (response: NextResponse) => {
    responseHeaders.forEach((value, key) => {
      response.headers.append(key, value);
    });
    return response;
  };

  // Pass-through for asset-like paths the matcher couldn't filter.
  if (pathname.includes(".")) {
    return withAuthHeaders(NextResponse.next());
  }

  // 1. Public paths.
  if (PUBLIC_PATHS.has(pathname)) {
    // /sign-in or /sign-up: bounce already-signed-in users with a pinned org
    // into the app instead of letting them re-auth.
    if (
      (pathname === "/sign-in" || pathname === "/sign-up") &&
      session?.organizationId
    ) {
      if (session.tenantStatus === "suspended") {
        return withAuthHeaders(
          NextResponse.rewrite(new URL("/suspended", request.url)),
        );
      }
      return withAuthHeaders(
        NextResponse.redirect(new URL("/dashboard", request.url)),
      );
    }
    return withAuthHeaders(NextResponse.next());
  }

  // 2. Authenticated zone — must be signed in.
  if (!session) {
    return withAuthHeaders(
      NextResponse.redirect(buildSignInUrl(request, pathname)),
    );
  }

  // 3. Signed in but no active org pinned → org picker.
  if (!session.organizationId) {
    return withAuthHeaders(
      NextResponse.redirect(new URL("/select-org", request.url)),
    );
  }

  // 4. Tenant suspended.
  if (session.tenantStatus === "suspended") {
    return withAuthHeaders(
      NextResponse.rewrite(new URL("/suspended", request.url)),
    );
  }

  // 5. Admin gate.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (session.role !== "super_admin") {
      return withAuthHeaders(
        NextResponse.rewrite(new URL("/forbidden", request.url)),
      );
    }
  }

  // 6. Stamp request headers for server components and `lib/api.ts`.
  const stamped = new Headers(request.headers);
  stamped.set("x-tenant-id", session.organizationId);
  if (session.role) stamped.set("x-user-role", session.role);

  return withAuthHeaders(NextResponse.next({ request: { headers: stamped } }));
}

export const config = {
  matcher: [
    "/((?!api/workos|_next|callback|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
