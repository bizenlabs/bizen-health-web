import "server-only";
import { forbidden, redirect } from "next/navigation";
import { getSession, type SessionClaims } from "@/lib/workos";
import type { Role } from "@/types/auth";

export type { Role };

export async function requireSession(): Promise<SessionClaims> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session;
}

export async function requireRole(...roles: Role[]): Promise<SessionClaims> {
  const session = await requireSession();
  const role = session.role;
  if (!role || !roles.some((r) => r === role)) forbidden();
  return session;
}

export async function hasRole(...roles: Role[]): Promise<boolean> {
  const session = await getSession();
  const role = session?.role;
  return !!role && roles.some((r) => r === role);
}
