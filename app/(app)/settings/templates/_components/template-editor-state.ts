/**
 * Result of a template editor Server Action.
 *
 * - `error` carries a form-level message (shown in the alert banner).
 * - `fieldErrors` maps a form field name to its message, so the editor can
 *   render a Catalyst `<ErrorMessage>` beneath the offending field.
 * - `savedAt` is a fresh timestamp on every successful edit — the edit form
 *   keys its "saved" confirmation off it, so two successive saves still
 *   register as distinct changes. (Create redirects on success, so only the
 *   edit form observes it.)
 */
export type TemplateFormState = {
  error: string | null;
  fieldErrors: Record<string, string>;
  savedAt: number | null;
};

export const TEMPLATE_FORM_INITIAL: TemplateFormState = {
  error: null,
  fieldErrors: {},
  savedAt: null,
};
