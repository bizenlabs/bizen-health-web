"use client";

import type { Role } from "@/types/auth";
import { useAuth } from "@/lib/workos-client";

type CanProps = {
  role: Role | Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

// UX-only role gate. Hides children when the active session role isn't in the
// allowed set. Never the security boundary — Spring Boot enforces real
// authorization independently for every endpoint.
export function Can({ role, children, fallback = null }: CanProps) {
  const { role: userRole } = useAuth();
  const allowed = Array.isArray(role)
    ? role.some((r) => r === userRole)
    : role === userRole;
  return <>{allowed ? children : fallback}</>;
}
