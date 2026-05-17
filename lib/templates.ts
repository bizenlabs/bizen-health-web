import "server-only";
import { api } from "@/lib/api";
import type { TemplateCategory } from "@/lib/template-categories";

/**
 * Clinical note templates — tenant-scoped, versioned Markdown scaffolds a
 * clinic admin curates. Each tenant is seeded with editable starters on
 * onboarding; the `system` flag records that provenance but does not lock the
 * row. Templates are retired, never deleted, so anything already referencing
 * one keeps resolving.
 *
 * Server-only BFF wrappers over the Spring `/v1/templates` surface. The
 * category constants live in `lib/template-categories.ts` (no `server-only`)
 * so Client Components can use them; they are re-exported here for the
 * convenience of server callers.
 */

export { CATEGORY_LABEL, TEMPLATE_CATEGORIES } from "@/lib/template-categories";
export type { TemplateCategory } from "@/lib/template-categories";

/** List-row shape — no `content`, to keep the list payload small. */
export type TemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  system: boolean;
  isDefault: boolean;
  version: number;
  retired: boolean;
  updatedAt: string;
};

/** Full template, including the Markdown `content`. */
export type TemplateDetail = TemplateSummary & {
  content: string | null;
  parentTemplateId: string | null;
  createdAt: string;
};

/** A frozen snapshot of a template at one past version. */
export type TemplateVersion = {
  versionNumber: number;
  name: string;
  description: string | null;
  category: TemplateCategory;
  content: string | null;
  createdAt: string;
};

/** Editable fields — the shape both create and update accept. */
export type TemplateInput = {
  name: string;
  description: string | null;
  category: TemplateCategory;
  content: string;
};

/** Templates for the active tenant; retired rows only when asked for. */
export const listTemplates = (includeRetired = false) =>
  api<TemplateSummary[]>(
    `/v1/templates${includeRetired ? "?includeRetired=true" : ""}`,
  );

export const getTemplate = (id: string) =>
  api<TemplateDetail>(`/v1/templates/${id}`);

export const createTemplate = (body: TemplateInput) =>
  api<TemplateDetail>("/v1/templates", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updateTemplate = (id: string, body: TemplateInput) =>
  api<TemplateDetail>(`/v1/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

/** Retire (soft-delete) — hidden from pickers, kept for history. */
export const retireTemplate = (id: string) =>
  api<TemplateDetail>(`/v1/templates/${id}`, { method: "DELETE" });

export const restoreTemplate = (id: string) =>
  api<TemplateDetail>(`/v1/templates/${id}/restore`, { method: "POST" });

/** Duplicate into a new editable template under a free "Copy of …" name. */
export const cloneTemplate = (id: string) =>
  api<TemplateDetail>(`/v1/templates/${id}/clone`, { method: "POST" });

/** Make a template the default for its category, demoting the current one. */
export const setDefaultTemplate = (id: string) =>
  api<TemplateDetail>(`/v1/templates/${id}/default`, { method: "POST" });

export const listTemplateVersions = (id: string) =>
  api<TemplateVersion[]>(`/v1/templates/${id}/versions`);

/** Re-apply a past version's content as a new current version. */
export const restoreTemplateVersion = (id: string, versionNumber: number) =>
  api<TemplateDetail>(`/v1/templates/${id}/versions/${versionNumber}/restore`, {
    method: "POST",
  });
