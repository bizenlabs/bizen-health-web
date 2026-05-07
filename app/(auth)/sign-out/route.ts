import { signOut } from "@/lib/workos";

// AuthKit's `signOut` clears the session cookie + PKCE leftovers and calls
// `redirect()` internally. The thrown NEXT_REDIRECT propagates out of the
// route handler and Next.js translates it into the actual HTTP redirect.
export async function GET() {
  await signOut({ returnTo: "/" });
}
