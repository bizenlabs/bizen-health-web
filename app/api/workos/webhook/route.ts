import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { workos } from "@/lib/workos";

// Events we forward to the BE. Anything else is acknowledged with 200 and
// dropped so WorkOS doesn't retry.
const SUBSCRIBED_EVENTS = new Set([
  "organization.created",
  "organization.updated",
  "user.created",
  "organization_membership.created",
  "organization_membership.updated",
  "organization_membership.deleted",
]);

export async function POST(request: NextRequest) {
  // Read the raw body first so we have it for both signature verification
  // (after parsing — the WorkOS SDK's verifyHeader calls JSON.stringify on
  // whatever `payload` you pass, so it must be the parsed object, not the
  // raw text) and for forwarding to Spring (we forward the raw bytes).
  const raw = await request.text();
  const sigHeader = request.headers.get("workos-signature");

  if (!sigHeader) {
    return new Response("Missing workos-signature header", { status: 400 });
  }

  let event: { event: string; data: unknown };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Malformed JSON", { status: 400 });
  }

  let valid = false;
  try {
    valid = await workos.webhooks.verifyHeader({
      payload: event,
      sigHeader,
      secret: env.WORKOS_WEBHOOK_SECRET,
    });
  } catch (err) {
    console.error("[workos webhook] verifyHeader threw", err);
    return new Response("Invalid signature", { status: 401 });
  }

  if (!valid) {
    return new Response("Invalid signature", { status: 401 });
  }

  if (!SUBSCRIBED_EVENTS.has(event.event)) {
    return new Response(null, { status: 200 });
  }

  try {
    const beResponse = await fetch(`${env.SPRING_BASE_URL}/webhooks/workos`, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Bizen-Webhook-Secret": env.BIZEN_INTERNAL_WEBHOOK_SECRET,
      },
      body: raw,
    });
    if (!beResponse.ok) {
      // Log but still 200 — the WorkOS event has been verified and persisted at
      // the BFF; let the BE outbox/retry handle transient downstream failures.
      console.error(
        "[workos webhook] BE forward non-2xx",
        beResponse.status,
        await beResponse.text().catch(() => ""),
      );
    }
  } catch (err) {
    console.error("[workos webhook] BE forward threw", err);
  }

  return new Response(null, { status: 200 });
}
