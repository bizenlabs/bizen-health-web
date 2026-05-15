export type AppointmentFormState = {
  error: string | null;
  fieldErrors: Record<string, string>;
};

export const APPOINTMENT_FORM_INITIAL: AppointmentFormState = {
  error: null,
  fieldErrors: {},
};
