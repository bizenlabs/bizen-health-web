import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";
import { getApiToken } from "@/lib/workos";

export type ProblemDetails = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  code?: string;
  fields?: { path: string; message: string }[];
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public fields: { path: string; message: string }[] = [],
    public problem?: ProblemDetails,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class UnauthorizedError extends ApiError {
  constructor() {
    super(401, "Unauthorized", "AUTH_REQUIRED");
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends ApiError {
  constructor(public payload: unknown) {
    const problem = isProblemDetails(payload) ? payload : undefined;
    super(
      403,
      problem?.detail ?? "Forbidden",
      problem?.code ?? "ACCESS_DENIED",
      problem?.fields ?? [],
      problem,
    );
    this.name = "ForbiddenError";
  }
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  return (
    typeof value === "object" &&
    value !== null &&
    ("code" in value || "title" in value || "detail" in value)
  );
}

async function readProblem(res: Response): Promise<ProblemDetails | null> {
  const ct = res.headers.get("content-type") ?? "";
  if (
    !ct.includes("application/problem+json") &&
    !ct.includes("application/json")
  ) {
    return null;
  }
  try {
    const body = (await res.json()) as unknown;
    return isProblemDetails(body) ? body : null;
  } catch {
    return null;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getApiToken();
  if (!token) throw new UnauthorizedError();
  const tenantId = (await headers()).get("x-tenant-id");
  return {
    Authorization: `Bearer ${token}`,
    ...(tenantId ? { "X-Tenant-Id": tenantId } : {}),
  };
}

async function throwForStatus(res: Response): Promise<void> {
  if (res.status === 401) throw new UnauthorizedError();
  if (res.status === 403) throw new ForbiddenError(await readProblem(res));
  if (!res.ok) {
    const problem = await readProblem(res);
    throw new ApiError(
      res.status,
      problem?.detail ?? `${res.status} ${res.statusText}`,
      problem?.code,
      problem?.fields ?? [],
      problem ?? undefined,
    );
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
  const auth = await authHeaders();
  const res = await fetch(`${env.SPRING_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...auth,
      ...(init.headers ?? {}),
    },
  });
  await throwForStatus(res);
  // Handle 202 Accepted / 204 No Content — empty bodies for callers that opt
  // in via `T = void` (e.g. the async user-management mutations).
  if (res.status === 202 || res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Multipart variant for file uploads. The browser/fetch sets the
 * {@code Content-Type} (including the boundary) when the body is a {@code
 * FormData} instance — so this helper deliberately omits the header that
 * {@link api} hardcodes. Same auth + tenant headers; same error handling.
 */
export async function apiMultipart<T>(
  path: string,
  formData: FormData,
  init: Omit<RequestInit, "body"> = {},
): Promise<T> {
  const auth = await authHeaders();
  const res = await fetch(`${env.SPRING_BASE_URL}${path}`, {
    ...init,
    body: formData,
    cache: "no-store",
    headers: {
      ...auth,
      ...(init.headers ?? {}),
    },
  });
  await throwForStatus(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Raw passthrough for byte streams (images, PDFs). Returns the {@link
 * Response} unparsed so route handlers can pipe it to the browser. Adds auth
 * + tenant headers; does NOT add Content-Type. Caller is responsible for
 * status handling — 401/403/404 are returned as-is, not thrown.
 */
export async function apiRaw(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const auth = await authHeaders();
  return fetch(`${env.SPRING_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...auth,
      ...(init.headers ?? {}),
    },
  });
}
