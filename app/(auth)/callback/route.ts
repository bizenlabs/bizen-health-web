import { type NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { handleAuth, saveSession, workos } from "@/lib/workos";

// AuthKit's standard callback expects both `code` and `state` (PKCE) — set
// when our /sign-in route initiated the OAuth flow. Invitation acceptance
// links go straight from the email to AuthKit's hosted page and back to our
// /callback with `code` only (no PKCE state cookie was ever planted on our
// domain). For that case we do a confidential code exchange ourselves using
// WORKOS_API_KEY (clientSecret) and then save the session.
const standard = handleAuth({ returnPathname: "/dashboard" });

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");

  if (code && !state) {
    try {
      const authResponse = await workos.userManagement.authenticateWithCode({
        clientId: env.WORKOS_CLIENT_ID,
        code,
      });
      await saveSession(authResponse, request);
      return NextResponse.redirect(new URL("/dashboard", request.url));
    } catch (error) {
      console.error("[callback] invitation code exchange failed", error);
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
  }

  return standard(request);
}
