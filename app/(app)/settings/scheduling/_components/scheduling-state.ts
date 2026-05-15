export type SchedulingState = {
  error: string | null;
  ok: string | null;
};

export const SCHEDULING_INITIAL: SchedulingState = { error: null, ok: null };
