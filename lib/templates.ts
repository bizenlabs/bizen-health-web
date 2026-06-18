import "server-only";
import { api } from "@/lib/api";
import type { TemplateCategory } from "@/lib/template-categories";

/**
 * Clinical note templates. The catalogue merges two stores:
 *  - `SYSTEM` templates — global, platform-published, read-only (`editable:
 *    false`). A clinic clones one to customise it; it never edits one in place.
 *  - `TENANT` templates — the clinic's own rows (authored or cloned), editable
 *    and versioned. Retired, never deleted, so anything referencing one resolves.
 *
 * `effectiveDefault` is the resolved default for the category: a tenant default
 * overrides the platform (system) default.
 *
 * Server-only BFF wrappers over the Spring `/v1/templates` surface. The
 * category constants live in `lib/template-categories.ts` (no `server-only`)
 * so Client Components can use them; they are re-exported here for the
 * convenience of server callers.
 */

export { CATEGORY_LABEL, TEMPLATE_CATEGORIES } from "@/lib/template-categories";
export type { TemplateCategory } from "@/lib/template-categories";

/** Which store a row comes from. */
export type TemplateSource = "SYSTEM" | "TENANT";

/** List-row shape — no `content`, to keep the list payload small. */
export type TemplateSummary = {
  id: string;
  source: TemplateSource;
  name: string;
  description: string | null;
  category: TemplateCategory;
  editable: boolean;
  isDefault: boolean;
  effectiveDefault: boolean;
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

/**
 * Permanently delete a tenant-owned template and its version history. System
 * templates are read-only and cannot be deleted (the API rejects with 403).
 */
export const deleteTemplate = (id: string) =>
  api<void>(`/v1/templates/${id}?purge=true`, { method: "DELETE" });

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
