// Client-side companion to `lib/workos.ts`. Keeps the "only `lib/workos.*`
// imports `@workos-inc/*`" invariant: server code uses `lib/workos`, client
// components use this module. Swapping IdPs stays a localized change.

export {
  useAuth,
  useAccessToken,
  useTokenClaims,
} from "@workos-inc/authkit-nextjs/components";
