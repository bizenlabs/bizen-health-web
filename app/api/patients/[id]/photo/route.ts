import { NextResponse } from "next/server";
import { apiRaw, UnauthorizedError } from "@/lib/api";
import { requireSession } from "@/lib/auth";

/**
 * BFF proxy for a patient's profile photo. The browser cannot call core
 * directly (no Bearer token), so this route forwards GET → core with the
 * authenticated user's auth + tenant headers and streams bytes back.
 *
 * Per the API URL convention memory, browser-only paths live under {@code
 * /api/*} while customer-callable APIs live under {@code /v1/*}.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    await requireSession();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return new NextResponse(null, { status: 401 });
    }
    throw err;
  }

  const { id } = await params;
  const upstream = await apiRaw(`/v1/patients/${id}/photo`);

  // 404 / 401 / 403 → mirror upstream status without leaking the body.
  if (upstream.status === 404) {
    return new NextResponse(null, { status: 404 });
  }
  if (upstream.status === 401 || upstream.status === 403) {
    return new NextResponse(null, { status: upstream.status });
  }
  if (!upstream.ok) {
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
