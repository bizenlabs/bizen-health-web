import { NextResponse } from "next/server";
import { apiRaw, UnauthorizedError } from "@/lib/api";
import { requireSession } from "@/lib/auth";

/**
 * BFF proxy for the active tenant's organization logo. The browser cannot call
 * core directly (no Bearer token), so this route forwards GET → core with the
 * authenticated user's auth + tenant headers and streams the bytes back.
 *
 * Per the API URL convention, browser-only paths live under {@code /api/*}
 * while customer-callable APIs live under {@code /v1/*}. Mirrors the
 * patient-photo proxy.
 */
export async function GET(): Promise<Response> {
  try {
    await requireSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new NextResponse(null, { status: 401 });
    }
    throw err;
  }

  const upstream = await apiRaw("/v1/organization/branding/logo");

  if (!upstream.ok) {
    // Mirror upstream status (404 when no logo, 401/403 on auth) without body.
    return new NextResponse(null, { status: upstream.status });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  const etag = upstream.headers.get("etag");
  if (etag) headers.set("ETag", etag);
  headers.set("Cache-Control", "private, max-age=60");

  return new NextResponse(upstream.body, { status: 200, headers });
}
