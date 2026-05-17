/**
 * Result of a template editor Server Action. On a successful create the action
 * redirects, so `savedAt` is observed only by the edit form — a fresh
 * timestamp on every success, so two successive saves still register as
 * distinct changes (the client effects key off it).
 */
export type TemplateFormState = {
  error: string | null;
  savedAt: number | null;
};

export const TEMPLATE_FORM_INITIAL: TemplateFormState = {
  error: null,
  savedAt: null,
};
