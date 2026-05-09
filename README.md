# Bizen Health Web

Web frontend for the Bizen hospital/clinic management platform. Acts as a BFF for a separate Spring Boot Modulith backend; auth and tenant management are handled via WorkOS AuthKit.

Stack: Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript · pnpm.

## Quickstart

```bash
pnpm install
cp .env.example .env.local        # then fill in real values (see below)
pnpm dev
```

Open <http://localhost:3000>.

### Required environment

Copy `.env.example` and fill in. All `WORKOS_*` values come from the WorkOS dashboard (<https://dashboard.workos.com>).

| Variable                          | Notes                                                                                                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`             | Origin Next.js runs on (e.g. `http://localhost:3000`).                                                                                                                      |
| `WORKOS_API_KEY`                  | Server-only.                                                                                                                                                                |
| `WORKOS_CLIENT_ID`                |                                                                                                                                                                             |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | Must match the Redirect URI registered in WorkOS. Default `http://localhost:3000/callback`. Read by `@workos-inc/authkit-nextjs`, so the `NEXT_PUBLIC_` prefix is required. |
| `WORKOS_COOKIE_PASSWORD`          | 32+ char random. Generate with `openssl rand -base64 32`.                                                                                                                   |
| `WORKOS_WEBHOOK_SECRET`           | From WorkOS Settings → Webhooks.                                                                                                                                            |
| `WORKOS_JWKS_URL`                 | Used by Spring Boot to validate JWTs.                                                                                                                                       |
| `SPRING_BASE_URL`                 | Backend origin. Default `http://localhost:8080`.                                                                                                                            |

### First tenant (manual, for local dev)

1. In the WorkOS dashboard, create an Organization (e.g. `bizen-demo`).
2. On the Organization, set `metadata.tenant_slug` to `demo` and `metadata.tenant_status` to `active`.
3. Invite yourself as a member with role `tenant_admin` (or `super_admin` if you want to access `/admin`).
4. Sign in at <http://localhost:3000/sign-in> — you should land at `/demo`.

## Architecture

See `docs/PLAN.md` for the full architecture and auth/tenant design. TL;DR:

- **Path-based tenancy**: every authenticated URL is `/<tenant-slug>/...`.
- **WorkOS Organization == 1 tenant.** JWT `org_id` claim is authoritative.
- **`proxy.ts`** (Next 16's renamed `middleware.ts`) is the tenant + auth gate. Reserved slugs, slug-vs-claim redirects, suspended-tenant rewrites, header stamping (`x-tenant-id`, `x-tenant-slug`, `x-user-role`).
- **`lib/api.ts`** is the only path the FE talks to Spring Boot. Adds `Authorization: Bearer <jwt>` + `X-Tenant-Id`. Browser never hits Spring directly.

## Common tasks

```bash
pnpm dev                  # dev server
pnpm build                # production build
pnpm exec tsc --noEmit    # type-check
pnpm lint                 # eslint
pnpm format               # prettier write
pnpm format:check         # prettier check
```

## Folder layout

```
app/                          App Router
├─ (marketing)/               public landing
├─ (auth)/                    WorkOS sign-in/sign-out/callback
├─ (app)/[tenant]/            authenticated tenant pages
├─ (admin)/admin/             super_admin console
├─ api/{workos,health}/       webhooks + liveness
proxy.ts                      tenant + auth gate (Next 16)
lib/
├─ env.ts                     Zod-validated env
├─ workos.ts                  server-side WorkOS adapter (only file importing @workos-inc/* on the server)
├─ workos-client.ts           client-side WorkOS hooks (useAuth, etc.)
├─ auth.ts                    requireSession / requireRole / hasRole
├─ tenant.ts                  getActiveTenant / requireActiveTenant
└─ api.ts                     server-only fetch wrapper for Spring Boot
components/
└─ auth/Can.tsx               UX-only RBAC component
types/auth.ts                 shared type union for Role
```

## Conventions

See [`AGENTS.md`](./AGENTS.md). Key rules: `proxy.ts` (not middleware), Next 16 async params/cookies/headers, WorkOS access only via `lib/workos.*`, FE role checks are UX-only.
