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
- **Browser never calls Spring Boot directly.** All cross-service calls go through `lib/api.ts`. Bearer JWT + `X-Tenant-Id` are added there.
- **FE role checks (`<Can>`, `hasRole()`) are UX-only.** Spring Boot is the real boundary and enforces role + `org_id` independently per endpoint.

### Files & layout

- Place server-only modules under `lib/` with `import "server-only"` at the top.
- Place client modules under `lib/*-client.ts` or `components/`.
- Route groups: `(marketing)` public, `(auth)` WorkOS flows, `(app)` authenticated app pages (`/dashboard`, `/settings`, …), `(admin)/admin` super-admin.
