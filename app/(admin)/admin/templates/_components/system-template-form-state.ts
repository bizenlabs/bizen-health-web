/**
 * Result of a system-template Server Action — same contract as the tenant
 * template editor's form state: `error` for the banner, `fieldErrors` keyed by
 * form field, `savedAt` freshly stamped on each successful edit.
 */
export type SystemTemplateFormState = {
  error: string | null;
  fieldErrors: Record<string, string>;
  savedAt: number | null;
};

export const SYSTEM_TEMPLATE_FORM_INITIAL: SystemTemplateFormState = {
  error: null,
  fieldErrors: {},
  savedAt: null,
};
