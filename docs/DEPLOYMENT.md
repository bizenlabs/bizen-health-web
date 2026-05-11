# Deployment (Vercel)

`bizen-health-web` deploys to **Vercel** for both staging and production.
There is no AWS infrastructure for the frontend. If PHI compliance ever
forces a move to AWS, see `bizen-health-core/docs/DEPLOYMENT.md` § 16
for the migration trigger and the work required.

## Topology

```
Browser
   │
   ▼
Vercel  (region bom1, Mumbai)
   ├─ Production deployment  →  app.bizenhealth.com       ← main branch
   └─ Preview alias           →  staging.bizenhealth.com  ← develop branch
   │
   │ Next BFF: proxy.ts, Server Actions, lib/api.ts
   │ HTTPS + Bearer JWT (from WorkOS session)
   ▼
api.bizenhealth.com  /  api.staging.bizenhealth.com  (AWS API Gateway)
```

The BFF is the only thing here that touches the BE. Browser never calls
Spring directly; see `AGENTS.md` for the convention.

## Vercel project setup

One Vercel project, linked to this repo, two Vercel environments:

| Vercel env | Git source               | Domain                    |
| ---------- | ------------------------ | ------------------------- |
| Production | `main` branch            | `app.bizenhealth.com`     |
| Preview    | `develop` branch (alias) | `staging.bizenhealth.com` |
| Preview    | other branches           | auto-assigned preview URL |

`vercel.json` pins the region to `bom1` (Mumbai) so functions sit
~5–10 ms from the BE in `ap-south-1`.

## Environment variables

Same schema as `lib/env.ts`. Set per Vercel environment (Production
and Preview separately) — these are managed in the Vercel dashboard,
not in the repo:

| Variable                          | Production                             | Preview (staging)                          |
| --------------------------------- | -------------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_APP_URL`             | `https://app.bizenhealth.com`          | `https://staging.bizenhealth.com`          |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | `https://app.bizenhealth.com/callback` | `https://staging.bizenhealth.com/callback` |
| `WORKOS_API_KEY`                  | prod WorkOS env                        | staging WorkOS env                         |
| `WORKOS_CLIENT_ID`                | prod WorkOS env                        | staging WorkOS env                         |
| `WORKOS_COOKIE_PASSWORD`          | `openssl rand -base64 32`              | distinct value                             |
| `WORKOS_WEBHOOK_SECRET`           | WorkOS dashboard → Webhooks (prod)     | WorkOS dashboard → Webhooks (staging)      |
| `WORKOS_JWKS_URL`                 | prod WorkOS JWKS URL                   | staging WorkOS JWKS URL                    |
| `BIZEN_INTERNAL_WEBHOOK_SECRET`   | shared with BE prod                    | shared with BE staging                     |
| `SPRING_BASE_URL`                 | `https://api.bizenhealth.com`          | `https://api.staging.bizenhealth.com`      |
| `LOG_LEVEL`                       | `info`                                 | `debug`                                    |

WorkOS uses **separate Environments per stage** (Production vs. Staging
in the WorkOS dashboard). Don't share keys across stages — prod users
and staging users must not collide.

## DNS

Both domains live in the `bizenhealth.com` Route 53 hosted zone managed
by `bizen-health-infra` (`BizenFoundationStaging` for the zone today,
prod when it lands). After the Vercel project is set up:

1. Add a custom domain to the Vercel project for each environment.
2. Vercel emits a CNAME target (`cname.vercel-dns.com`) plus an ACM
   verification record.
3. Add both as records in the Route 53 zone.
4. Vercel issues the TLS cert automatically.

## WorkOS callback URLs

Register in the WorkOS dashboard, per environment:

- Production WorkOS env → `https://app.bizenhealth.com/callback`
- Staging WorkOS env → `https://staging.bizenhealth.com/callback`

Same for webhook endpoints (`/api/workos/webhook`).

## CI / deploy

Vercel auto-deploys on every push:

- Push to `main` → Production deployment, replaces `app.bizenhealth.com`.
- Push to `develop` → Preview deployment, aliased to `staging.bizenhealth.com`.
- Push to any other branch / PR → Preview deployment at an auto-assigned URL.

There is no GitHub Actions workflow for the frontend.

## Migration trigger

The Vercel choice is **time-boxed**. The frontend moves to AWS (ECS
Fargate + RDS + ALB) the moment any of these becomes true:

1. First real patient record in any environment. Vercel Pro doesn't
   include a HIPAA BAA; storing/processing PHI through it is a
   compliance violation.
2. First customer contract requiring a HIPAA BAA.
3. Vercel Pro overages exceed ~$200/month.

When that happens, scaffold a new `BizenWebStack` from scratch against
then-current CDK APIs — there is no preserved Dockerfile or CDK to
"restore." See `bizen-health-core/docs/DEPLOYMENT.md` § 16 for the
full migration runbook and cost delta.

## Out of scope

- AWS infrastructure (intentionally).
- Self-hosted analytics / RUM (use Vercel's built-in for now).
- Edge-deployed routes — everything runs on the Node runtime per
  `AGENTS.md` (`proxy.ts` is Node-only in Next 16).
- Custom build pipeline / Docker images.
