export type EncounterFormState = {
  error: string | null;
  fieldErrors: Record<string, string>;
};

export const ENCOUNTER_FORM_INITIAL: EncounterFormState = {
  error: null,
  fieldErrors: {},
};
