/**
 * Assignable WorkOS role slugs surfaced in team management. `super_admin` is
 * intentionally absent — it is provisioned out-of-band and bizen-health-core
 * rejects assigning it through tenant user management. Slugs must match the
 * WorkOS dashboard and the core `Role` enum.
 *
 * Plain module (no "server-only"/"use client") so both the server page and
 * the client components can import it.
 */
export const ROLES = [
  { slug: "tenant_admin", label: "Admin" },
  { slug: "clinician", label: "Clinician" },
  { slug: "receptionist", label: "Receptionist" },
] as const;

/** Human label for a role slug; falls back to the raw slug, then an em dash. */
export function roleLabel(slug: string | null | undefined): string {
  return ROLES.find((r) => r.slug === slug)?.label ?? slug ?? "—";
}
