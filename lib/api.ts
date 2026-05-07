import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";
import { getApiToken } from "@/lib/workos";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor() {
    super(401, "Unauthorized");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(public payload: unknown) {
    super(403, "Forbidden");
    this.name = "ForbiddenError";
  }
}

// Server-only fetch wrapper for Spring Boot. Adds Authorization (Bearer JWT)
// and X-Tenant-Id (mirrors the active org claim) on every call. The JWT is the
// real authority — X-Tenant-Id is for trace clarity.
//
// Callers should let UnauthorizedError / ForbiddenError propagate so an
// `error.tsx` boundary or a Server Action wrapper can convert them to redirects
// (`/sign-in`, `/suspended`).
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getApiToken();
  if (!token) throw new UnauthorizedError();
  const tenantId = (await headers()).get("x-tenant-id");

  const res = await fetch(`${env.SPRING_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (res.status === 401) throw new UnauthorizedError();
  if (res.status === 403) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      // body may not be JSON
    }
    throw new ForbiddenError(payload);
  }
  if (!res.ok) throw new ApiError(res.status, await res.text());

  // Handle 204 No Content / empty bodies for callers that opt in via `T = void`.
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
