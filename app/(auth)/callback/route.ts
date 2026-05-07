import { handleAuth } from "@/lib/workos";

// AuthKit's `handleAuth` does the OAuth code exchange, sets the session cookie,
// and redirects to `returnPathname` (or whatever `returnTo` was set on the
// originating `getSignInUrl` call, taking precedence). We default to
// "/dashboard" so the proxy can decide where the user actually lands based on
// session state (no org pinned → /select-org; suspended → /suspended).
export const GET = handleAuth({ returnPathname: "/dashboard" });
