import "server-only";
import { api } from "@/lib/api";
import type { TemplateCategory } from "@/lib/template-categories";
import type { TemplateSpecialty } from "@/lib/template-specialties";

/**
 * Super-admin publishing surface for the global system-template library —
 * server-only BFF wrappers over `/internal/admin/system-templates`.
 *
 * Rows come in two kinds, distinguished by `managed`: managed rows are owned by
 * the backend code seed (edited in `DefaultTemplates.java`, reconciled on every
 * deploy) and are read-only here; authored rows (`managed: false`) are published
 * at runtime — created below or promoted from a tenant template via
 * `promoteTemplate` in `lib/templates.ts` — and are the only ones this surface
 * may edit, deactivate or reactivate.
 */

export type SystemTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  specialty: TemplateSpecialty | null;
  content: string | null;
  exampleOutput: string | null;
  isDefault: boolean;
  active: boolean;
  managed: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

/** Editable fields — the shape both publish and update accept. */
export type SystemTemplateInput = {
  name: string;
  description: string | null;
  category: TemplateCategory;
  specialty: TemplateSpecialty | null;
  content: string;
  exampleOutput: string | null;
};

/** The whole global library, active and inactive, ordered by name. */
export const listSystemTemplates = () =>
  api<SystemTemplate[]>("/internal/admin/system-templates");

export const getSystemTemplate = (id: string) =>
  api<SystemTemplate>(`/internal/admin/system-templates/${id}`);

/** Publish a new authored system template — visible to every tenant immediately. */
export const publishSystemTemplate = (body: SystemTemplateInput) =>
  api<SystemTemplate>("/internal/admin/system-templates", {
    method: "POST",
    body: JSON.stringify(body),
  });

/** Edit an authored system template; managed rows are rejected with 403. */
export const updateSystemTemplate = (id: string, body: SystemTemplateInput) =>
  api<SystemTemplate>(`/internal/admin/system-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

/** Unpublish an authored system template, hiding it from every tenant. */
export const deactivateSystemTemplate = (id: string) =>
  api<SystemTemplate>(`/internal/admin/system-templates/${id}/deactivate`, {
    method: "POST",
  });

/** Re-publish a previously deactivated authored system template. */
export const activateSystemTemplate = (id: string) =>
  api<SystemTemplate>(`/internal/admin/system-templates/${id}/activate`, {
    method: "POST",
  });
