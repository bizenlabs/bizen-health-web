/**
 * Result of a reference-data Server Action. `savedAt` is a fresh timestamp on
 * every success — the client effects key off it (close the edit row, reset
 * the add form) so two successive saves still register as distinct changes.
 */
export type RefDataActionState = {
  error: string | null;
  savedAt: number | null;
};

export const REF_DATA_INITIAL: RefDataActionState = {
  error: null,
  savedAt: null,
};
