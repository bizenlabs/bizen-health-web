/**
 * Template category constants — the note-type buckets a template belongs to.
 *
 * This module is deliberately free of `server-only` (and of any `lib/api`
 * import chain) so the Client Component template editor can pull the category
 * list and labels for its `<select>`. The server-side BFF wrappers live in
 * `lib/templates.ts`, which re-exports these for server callers.
 */

/** The note-type buckets a template can belong to — mirrors the API enum. */
export const TEMPLATE_CATEGORIES = [
  "SOAP",
  "HISTORY_AND_PHYSICAL",
  "PROGRESS",
  "PROCEDURE",
  "DISCHARGE",
  "REFERRAL",
  "DICTATION",
  "OTHER",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

/** Human label for a category — for headings, selects and chips. */
export const CATEGORY_LABEL: Record<TemplateCategory, string> = {
  SOAP: "SOAP note",
  HISTORY_AND_PHYSICAL: "History & physical",
  PROGRESS: "Progress note",
  PROCEDURE: "Procedure note",
  DISCHARGE: "Discharge summary",
  REFERRAL: "Referral letter",
  DICTATION: "Dictation",
  OTHER: "Other",
};
