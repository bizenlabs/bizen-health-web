<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Project conventions

### Next.js 16 specifics

- **`proxy.ts`, not `middleware.ts`.** The function must be exported as `proxy` (named or default). Edge runtime is not supported in proxy; runtime is Node and not configurable. Don't recreate `middleware.ts` — Next will warn and ignore it.
- **`params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are all Promises.** Always `await` them. Synchronous access has been removed.
- **`fetch` is not auto-cached.** Opt in with `'use cache'` or explicit `cache:`. The BFF→Spring wrapper (`lib/api.ts`) uses `cache: 'no-store'`.
- **Server Functions can bypass the proxy matcher.** Always re-verify auth inside Server Actions via `requireSession()` / `requireRole()` from `lib/auth.ts`. Never rely on the proxy as the security boundary.
- **Use auto-generated `LayoutProps<'/path'>` and `PageProps<'/path'>`.** They come from `next typegen` and are globally available. Don't hand-roll equivalents.

### Auth + tenancy

- **WorkOS is only imported through `lib/workos.ts` (server) and `lib/workos-client.ts` (client).** Nothing else in the repo imports `@workos-inc/*`. Swapping IdPs stays a localized change.
- **Tenant primitive = WorkOS Organization.** A user may belong to multiple Organizations; the session pins exactly one as active. Tenancy is **stateless** — the active org lives in the session (`session.organizationId`), never in the URL. `session.tenantSlug` is for display only.
- **`tenant_id` carrier:** JWT claim `org_id` is authoritative. `proxy.ts` stamps `x-tenant-id` and `x-user-role` as request headers; `lib/api.ts` reads `x-tenant-id` directly, and other server code can use `getActiveOrgId()` from `lib/tenant.ts`.
- **Org selection / switching:** users with no pinned org are bounced to `/select-org`. The `switchOrgAction` Server Action (`app/select-org/actions.ts`) is the only entry point for switching; both `/select-org` and the in-app `<OrgSwitcher>` invoke it. The BE slug-blacklist still applies (slugs are display labels and must remain unique), but `proxy.ts` no longer maintains a `RESERVED_SLUGS` list.
- **Self-serve signup:** `/sign-up` redirects to AuthKit hosted signup. After callback, the wizard at `/onboarding` (`app/onboarding/page.tsx` + `actions.ts`) creates a WorkOS Organization with auto-generated `tenant_slug` (`lib/slug.ts`) and `metadata.org_type ∈ {'individual','clinic'}`, then pins the user as `tenant_admin`. Invitees skip the wizard — their callback already returns with the org pinned.
- **Team management:** `/settings/staff` (tenant_admin only) lists members + pending invitations and exposes invite/revoke/remove via Server Actions in `app/(app)/settings/staff/actions.ts`. Inviting the first teammate from an `org_type === 'individual'` org transparently flips the org to `'clinic'`.
- **Browser never calls Spring Boot directly.** All cross-service calls go through `lib/api.ts`. Bearer JWT + `X-Tenant-Id` are added there.
- **FE role checks (`<Can>`, `hasRole()`) are UX-only.** Spring Boot is the real boundary and enforces role + `org_id` independently per endpoint.
- **WorkOS role slugs in use:** `super_admin`, `tenant_admin`, `clinician`, `receptionist`. Must match what's configured in the WorkOS dashboard.

### Billing

- **Core is the source of truth**, not this app. Spring's `billing` module owns plan, subscription and invoice state and enforces the write boundary itself; everything here is display and convenience.
- **Session-carried billing state.** `session.billingStatus` / `planCode` / `billingDeadline` come from WorkOS org metadata that core mirrors into. The proxy already reads metadata every request, so this costs **no** extra call — but it is a cache, and a stale value can only make a banner wrong.
- **`orgMetadataFromSession` (`lib/workos-metadata.ts`) is the wipe guard.** WorkOS replaces org metadata wholesale on update, so every writer must round-trip the full record. A new key must be added there _and_ to `orgMetadataToSession`, or it gets silently erased the next time anyone renames the org. `lib/workos-metadata.test.ts` fails if you forget.
- **402 means read-only.** `lib/api.ts` throws `BillingReadOnlyError` (an `ApiError` subclass) so every existing `run()` helper in every `actions.ts` renders it inline with no per-action changes.
- **`useBillingWritable()` is UX-only**, exactly like `<Can>`. Use it to disable primary CTAs; don't try to gate every form — Spring is the boundary and 402 already surfaces correctly.
- **Reads and exports are never gated**, in any billing state. A clinic that stops paying keeps full access to view, search and export its patient records.
- **No Razorpay credentials live in this app.** Checkout redirects to Razorpay's hosted `short_url` and webhooks go straight to Spring, so there are no `NEXT_PUBLIC_RAZORPAY_*` vars and nothing to add to `lib/env.ts`.

### Files & layout

- Place server-only modules under `lib/` with `import "server-only"` at the top.
- Place client modules under `lib/*-client.ts` or `components/`.
- Route groups: `(marketing)` public, `(auth)` WorkOS flows, `(app)` authenticated app pages (`/dashboard`, `/settings`, …), `(admin)/admin` super-admin.
