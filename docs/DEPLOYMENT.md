# Deployment Architecture (E2E)

End-to-end view of how `bizen-health-web` is built, packaged, deployed, and served. The repo supports two parallel deploy targets:

1. **AWS ECS Fargate** (production, infra-as-code via CDK in `infra/cdk/`).
2. **Vercel** (preview/staging, no infra in this repo — `vercel.json` only pins the region).

Both consume the same Next.js 16 source tree. The only branch in build behavior is `next.config.ts:7`: `output: 'standalone'` is enabled when `BUILD_TARGET=docker`, otherwise Next emits its default output (which is what Vercel wants).

---

## 1. Runtime topology (AWS, prod)

```
                    ┌──────────────────────────────────────────┐
                    │  Route 53  (bizenhealth.com hosted zone) │
                    │  app.bizenhealth.com  →  ALB             │
                    └────────────────────┬─────────────────────┘
                                         │ HTTPS (ACM cert)
                                         ▼
                    ┌──────────────────────────────────────────┐
   Internet  ─────▶ │  Application Load Balancer (public)      │
                    │  Listener :443  ─ target group :3000     │
                    │  Health: GET /api/health                 │
                    └────────────────────┬─────────────────────┘
                                         │ HTTP (intra-VPC)
                                         ▼
                    ┌──────────────────────────────────────────┐
                    │  ECS Fargate service (bizen-health-web)  │
                    │  TaskDef: 256 CPU / 512 MiB              │
                    │  Container: app  (port 3000)             │
                    │  Image: ECR repo, tag = git sha          │
                    │  Public subnet + public IP               │
                    │   ├─ env (NEXT_PUBLIC_* + LOG_LEVEL)     │
                    │   └─ secrets ←─ Secrets Manager          │
                    │                  bizen-health-web/prod   │
                    └────────────────────┬─────────────────────┘
                                         │ HTTPS
                                         ▼
                    ┌──────────────────────────────────────────┐
                    │  Spring Boot Modulith (separate stack)   │
                    │  SPRING_BASE_URL                         │
                    │  Validates JWT against WORKOS_JWKS_URL   │
                    └──────────────────────────────────────────┘

    Auth side-channel
    ─────────────────
        Browser ───▶ AuthKit hosted UI (workos.com)
                  ◀── code → /callback → session cookie
        WorkOS  ───▶ /api/workos/* webhooks  (signed by WORKOS_WEBHOOK_SECRET)
```

### Key facts

- **VPC layout**: 2 AZs, **public subnets only, no NAT gateway**. Tasks are assigned a public IP and reach ECR / Secrets Manager / CloudWatch via the Internet Gateway. The ALB is the only public ingress; the task security group only accepts traffic from the ALB SG. (`infra/cdk/lib/web-stack.ts:45-51, 170-174`.)
- **TLS terminates at the ALB.** The container speaks plain HTTP on port 3000. ACM cert is DNS-validated against the Route 53 hosted zone.
- **Health check**: ALB target group hits `GET /api/health` (`web-stack.ts:177-184`). The Dockerfile also defines a container-level `HEALTHCHECK` (`Dockerfile:77-78`).
- **Autoscaling**: 1–4 tasks, target 70% CPU, 1 min scale-out / 2 min scale-in cooldown. (`web-stack.ts:186-194`.)
- **Deploy strategy**: rolling update, 100% min healthy / 200% max, with circuit breaker rollback on failed deploys. (`web-stack.ts:167-169`.)
- **Region**: `ap-south-1` (Mumbai). Set in `infra/cdk/bin/app.ts:10` and `.github/workflows/deploy.yml:13`.

---

## 2. Build pipeline (GitHub → ECR → ECS)

`.github/workflows/deploy.yml` runs on every push to `main`:

1. **OIDC into AWS** — assumes the role created by CDK (`GitHubDeployRoleArn` output). No long-lived AWS keys in GitHub. Trust policy pins `repo:bizenlabs/bizen-health-web:ref:refs/heads/main` (`web-stack.ts:200-220`).
2. **Login to ECR**, set up Buildx.
3. **Build + push** a multi-arch image:
   - Tag = first 12 chars of the commit SHA, plus `latest`.
   - `--platform linux/amd64` (Fargate task is X86_64 — `web-stack.ts:99`).
   - Cache: `--cache-from registry:latest`, `--cache-to inline`.
4. **Render new task definition** — pulls the _current_ TD via `ecs describe-services`, swaps just the `app` container's `image`, and registers a new revision via `aws-actions/amazon-ecs-render-task-definition` + `amazon-ecs-deploy-task-definition`.
5. **Wait for service stability** before the job exits.

**Implication**: env vars and secrets in the task definition are _not_ re-templated by CI. The CDK stack owns the schema; CI only swaps the image. To change env or secret bindings, redeploy CDK.

```
git push main
   │
   ▼
GitHub Actions (deploy-prod, single-flight)
   │  OIDC AssumeRole
   ▼
ECR push:  bizen-health-web:<sha12>   bizen-health-web:latest
   │
   ▼
ECS RegisterTaskDefinition (new revision, new image)
   │
   ▼
ECS UpdateService → rolling deploy (circuit breaker armed)
```

---

## 3. Image (Dockerfile)

Multi-stage, `node:22-alpine`, pnpm via corepack. (`Dockerfile`.)

| Stage     | Purpose                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------- |
| `base`    | Node 22 + libc6-compat + corepack                                                                        |
| `deps`    | `pnpm install --frozen-lockfile` with a cache mount on the pnpm store. `HUSKY=0`.                        |
| `builder` | Copies sources, sets `BUILD_TARGET=docker` so `next.config.ts` flips to `standalone`, runs `pnpm build`. |
| `runner`  | Copies `.next/standalone` + `.next/static` + `public/`, runs as uid 1001, `node server.js`.              |

**Build-time env placeholders** (`Dockerfile:44-51`): `lib/env.ts` is reachable from server modules and parses on module load, so `next build` would fail without valid-looking values. The `runner` stage does **not** carry these forward — runtime env comes entirely from the ECS task definition.

**Standalone output** is what allows the `runner` image to be a tiny Node-only image with no `pnpm` and a minimal `node_modules`.

---

## 4. Configuration & secrets

### Schema (single source of truth)

`lib/env.ts` Zod-validates `process.env` at module load. Both the Dockerfile build placeholders (`Dockerfile:44-51`) and the CDK task definition (`web-stack.ts:108-142`) must satisfy this schema.

| Variable                          | Where it's set in prod              | Public? |
| --------------------------------- | ----------------------------------- | ------- |
| `NEXT_PUBLIC_APP_URL`             | TaskDef env (derived from domain)   | ✅      |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | TaskDef env (derived from domain)   | ✅      |
| `LOG_LEVEL`                       | TaskDef env (`info` in prod)        | —       |
| `WORKOS_API_KEY`                  | Secrets Manager → TaskDef `secrets` | ❌      |
| `WORKOS_CLIENT_ID`                | Secrets Manager → TaskDef `secrets` | ❌      |
| `WORKOS_COOKIE_PASSWORD`          | Secrets Manager → TaskDef `secrets` | ❌      |
| `WORKOS_WEBHOOK_SECRET`           | Secrets Manager → TaskDef `secrets` | ❌      |
| `WORKOS_JWKS_URL`                 | Secrets Manager → TaskDef `secrets` | ❌      |
| `SPRING_BASE_URL`                 | Secrets Manager → TaskDef `secrets` | ❌      |

Note: `SPRING_BASE_URL` is held in Secrets Manager not because the URL is sensitive, but to keep the upstream backend address mutable without a CDK redeploy.

### Secrets lifecycle

- The CDK stack creates the **shell** of `bizen-health-web/prod` in Secrets Manager with `REPLACE_ME` placeholders (`web-stack.ts:76-93`).
- The operator populates real values **after first `cdk deploy`** via the AWS console or CLI. Subsequent `cdk deploy` runs do **not** overwrite the populated values, because `secretObjectValue` is only used at create-time when the secret doesn't already exist (CloudFormation will not roll back the populated value as long as the logical resource keeps its identity).
- The container reads them via the ECS `secrets` mapping, which resolves them to env vars at task start. The Next.js process sees them as plain `process.env` entries.

### Local dev

Env comes from `.env.local` (gitignored). Schema is the same. Generate `WORKOS_COOKIE_PASSWORD` with `openssl rand -base64 32`.

---

## 5. Request flow at runtime

### a) Authenticated page request

```
Browser ──▶ ALB ──▶ Fargate task (Next server)
                         │
                         ▼
                    proxy.ts
                      ├─ authenticateRequest() → AuthKit session
                      ├─ public path? → pass through
                      ├─ no session? → redirect /sign-in
                      ├─ no org pinned? → redirect /select-org
                      ├─ tenant suspended? → rewrite /suspended
                      ├─ /admin/* + role≠super_admin? → /forbidden
                      └─ stamp x-tenant-id, x-user-role
                         │
                         ▼
                    App Router (RSC)
                         │  RSC may call lib/api.ts
                         ▼
                    lib/api.ts
                      ├─ Authorization: Bearer <jwt> (from session)
                      ├─ X-Tenant-Id (from request headers)
                      └─ cache: 'no-store'
                         │
                         ▼
                    Spring Boot  (validates JWT vs WORKOS_JWKS_URL,
                                   re-checks org_id + role)
```

Spring Boot is the **real boundary**. `proxy.ts` is "optimistic" per Next 16 docs — it can be silently bypassed by Server Actions, so each Server Action also calls `requireSession()` / `requireRole()` from `lib/auth.ts`. (See `AGENTS.md` and `proxy.ts:16-20`.)

### b) WorkOS callback

`/callback` is a public path (`proxy.ts:33`). AuthKit exchanges the `code` for tokens, encrypts them with `WORKOS_COOKIE_PASSWORD`, and sets the session cookie. Subsequent requests hit `proxy.ts` with a session and get routed by org-pin status.

### c) WorkOS webhooks

`/api/workos/*` is excluded from the proxy matcher (`proxy.ts:126`) so the webhook handler can verify the HMAC signature against `WORKOS_WEBHOOK_SECRET` without proxy interference.

---

## 6. Vercel path (preview/staging)

`vercel.json` only pins region `bom1`. Vercel detects Next.js, runs `pnpm build` with `BUILD_TARGET` **unset** → default Next output, served by Vercel's own runtime. CDK / ECR / ECS are not involved.

Env vars must be set in the Vercel project — same schema as `lib/env.ts`. The redirect URI registered in WorkOS must include the Vercel preview/prod URLs.

This path exists so we can ship preview deploys for review without bringing up infra. Production traffic at `app.bizenhealth.com` resolves to the AWS ALB, not Vercel.

---

## 7. Observability

- **Logs**: container stdout → `awslogs` driver → CloudWatch log group `/ecs/bizen-health-web`, retention 30 days, non-blocking driver mode (drops log lines under load rather than blocking the app). (`web-stack.ts:67-71, 143-147`.)
- **Metrics**: ECS Container Insights v2 enabled on the cluster (`web-stack.ts:64`).
- **Health**: `GET /api/health` (`app/api/health/route.ts`) is hit by the ALB target group every 30s and by the container `HEALTHCHECK` every 30s.
- **Image scanning**: ECR `imageScanOnPush: true` (`web-stack.ts:33`).

---

## 8. IAM surface

CDK provisions and grants:

- **Task execution role** (auto-created by `FargateTaskDefinition`) — pulls images from ECR, fetches Secrets Manager values, writes to CloudWatch Logs.
- **Task role** (auto-created) — currently has no app-specific permissions; add policies here as the app starts calling AWS APIs directly.
- **GitHub OIDC role** (`bizen-health-web-gh-deploy`) — assumed by `bizenlabs/bizen-health-web` on `main` only. Permissions:
  - `ecr:GetAuthorizationToken` (account-wide), plus push/pull on the repo.
  - `ecs:Describe*`, `ecs:RegisterTaskDefinition`, `ecs:UpdateService` (account-wide — narrow to cluster ARN if multi-tenant later).
  - `iam:PassRole` on the task + execution roles, conditioned on `iam:PassedToService = ecs-tasks.amazonaws.com`.
- **OIDC provider** for `token.actions.githubusercontent.com` is created by this stack; if another stack already created one in the account, switch to `fromOpenIdConnectProviderArn` (`web-stack.ts:200-203`).

---

## 9. Bootstrap (one-time, per environment)

1. `cd infra/cdk && npm ci && npx cdk bootstrap` against the target account/region.
2. `npx cdk deploy BizenHealthWebProd` — creates VPC, ALB, cluster, ECR, Secrets Manager shell, OIDC provider, IAM role.
3. Populate `bizen-health-web/prod` in Secrets Manager with real WorkOS values + `SPRING_BASE_URL`.
4. Add the `GitHubDeployRoleArn` output to GitHub repo secrets as `AWS_DEPLOY_ROLE_ARN`.
5. Push to `main` — first deploy will fail-fast if any secret is still `REPLACE_ME` (validated by `lib/env.ts` at container start). Re-deploy via `workflow_dispatch` once the secret is fixed.
6. In WorkOS dashboard, register `https://app.bizenhealth.com/callback` as a Redirect URI. Add the `/api/workos/*` URL as the webhook endpoint and copy the signing secret into `WORKOS_WEBHOOK_SECRET`.

---

## 10. Failure modes & rollback

| Failure                           | Behavior                                                                                |
| --------------------------------- | --------------------------------------------------------------------------------------- |
| New task fails health check       | ECS deployment circuit breaker rolls back to previous TD revision (`web-stack.ts:167`). |
| Bad env / secret value            | Container crashes on `lib/env.ts` Zod parse → ALB marks unhealthy → circuit breaker.    |
| WorkOS down                       | Sign-in fails; existing sessions still work until cookie expiry.                        |
| Spring Boot down                  | `lib/api.ts` throws `ApiError`; caller (Server Action / RSC) surfaces an error UI.      |
| Bad image pushed but task healthy | Manual rollback: `aws ecs update-service --task-definition <old-revision>`.             |
| Region outage                     | No multi-region today. Recovery = redeploy CDK in another region + repoint Route 53.    |

---

## 11. What is _not_ in this stack (yet)

- No CDN in front of the ALB. Static assets ship from the Next runtime. Add CloudFront if asset latency outside `ap-south-1` becomes a concern.
- No WAF on the ALB. Add `aws-wafv2` if/when compliance requires it.
- No staging environment in CDK — Vercel previews fill that role today. To add one, instantiate a second `WebStack` with a different `domainName`/`serviceName` in `bin/app.ts`.
- No multi-region failover.
- No private subnets / VPC endpoints. Trade-off: NAT gateway cost (~$32/mo/AZ) vs. tasks having public IPs. Revisit if the security model tightens.
