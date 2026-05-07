import "server-only";
import { randomUUID } from "node:crypto";

// `^[a-z0-9-]{3,40}$` is the BE validation rule. We aim for the same shape
// here so the auto-generated slug is unlikely to be rejected post-creation.
export function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "") // strip combining marks (accents, diacritics)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Auto-generates a tenant slug from a workspace name. WorkOS doesn't index
// metadata, so we don't pre-check uniqueness; the random suffix makes
// collisions astronomically unlikely. BE owns canonical uniqueness.
export function generateOrgSlug(name: string): string {
  const base = slugify(name) || "clinic";
  const suffix = randomUUID().replace(/-/g, "").slice(0, 6);
  // Trim base so the combined slug stays within 40 chars.
  const trimmedBase = base.slice(0, 40 - suffix.length - 1);
  return `${trimmedBase}-${suffix}`;
}
