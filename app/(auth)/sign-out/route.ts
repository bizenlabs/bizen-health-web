import { signOut } from "@/lib/workos";

// Sign-out is destructive and non-idempotent (it clears the session cookie),
// so it MUST NOT be reachable by GET. A GET handler here gets prefetched by
// `<Link>` the moment the account menu opens — and link unfurlers, URL
// scanners, etc. would hit it too — silently signing the user out. The account
// menu submits a POST form to this handler instead.
//
// `signOut` (lib/workos.ts) clears the session cookie + PKCE leftovers and
// redirects to WorkOS's logout endpoint with an absolute `return_to` derived
// from this deployment's origin. The thrown NEXT_REDIRECT propagates out of
// the route handler and Next.js translates it into the actual HTTP redirect.
export async function POST() {
  await signOut();
}
