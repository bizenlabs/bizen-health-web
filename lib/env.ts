import "server-only";
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),

  WORKOS_API_KEY: z.string().min(1),
  WORKOS_CLIENT_ID: z.string().min(1),
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: z.url(),
  WORKOS_COOKIE_PASSWORD: z.string().min(32),
  WORKOS_WEBHOOK_SECRET: z.string().min(1),
  WORKOS_JWKS_URL: z.url(),

  SPRING_BASE_URL: z.url(),
  // Shared secret the BFF stamps on `X-Bizen-Webhook-Secret` when forwarding
  // verified WorkOS events to Spring Boot. Distinct from WORKOS_WEBHOOK_SECRET
  // — the BFF is the trust boundary that already validated the WorkOS HMAC.
  BIZEN_INTERNAL_WEBHOOK_SECRET: z.string().min(16),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.treeifyError(parsed.error));
  throw new Error("Invalid environment variables — see .env.example");
}

export const env = parsed.data;
export type Env = typeof env;
