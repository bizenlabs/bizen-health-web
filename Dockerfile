# syntax=docker/dockerfile:1.7

# Multi-stage build for Next.js 16 in standalone mode.
#
# Build:   docker build -t bizen-health-web .
# Run:     docker run --rm -p 3000:3000 --env-file .env.local bizen-health-web
#
# Real WorkOS / Spring values are injected at runtime by the deploy target
# (Cloud Run, ECS, K8s, etc.). The placeholders below only have to pass the
# Zod validation in lib/env.ts during `next build` — the build doesn't talk
# to WorkOS, but `import "@/lib/env"` is reachable from server modules and
# parses on module load.

# ---- Base ---------------------------------------------------------------
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable

# ---- Dependencies -------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# HUSKY=0 disables the `prepare` hook in package.json. Husky needs a .git
# directory (we excluded it via .dockerignore), and there are no commits
# happening inside the container anyway.
ENV HUSKY=0
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- Builder ------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Switch next.config.ts to output:'standalone'. Vercel builds leave this unset
# so they get the default .next output.
ENV BUILD_TARGET=docker

# Build-time placeholders — must pass lib/env.ts validation but never reach
# the runtime image. The deploy target overrides every one of these.
ENV NEXT_PUBLIC_APP_URL=http://localhost:3000 \
    WORKOS_API_KEY=build_placeholder \
    WORKOS_CLIENT_ID=build_placeholder \
    NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/callback \
    WORKOS_COOKIE_PASSWORD=build_placeholder_cookie_password_32chars_min \
    WORKOS_WEBHOOK_SECRET=build_placeholder \
    WORKOS_JWKS_URL=https://api.workos.com/sso/jwks/build_placeholder \
    SPRING_BASE_URL=http://localhost:8080

RUN pnpm build

# ---- Runner -------------------------------------------------------------
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone output: server.js + minimal node_modules. Static assets live
# next to it under .next/static, public/ stays at the root.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Light health probe — /api/health is implemented by app/api/health/route.ts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
