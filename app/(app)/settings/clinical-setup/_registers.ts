import type { RegisterKey } from "@/lib/reference-data";

export type Register = {
  key: RegisterKey;
  title: string;
  singular: string;
  blurb: string;
};

// The reference-data registers, in display order. Adding a register is a
// one-line entry here (plus the backend support) — the rail and the page both
// read from this single source of truth.
export const REGISTERS: Register[] = [
  {
    key: "visit-types",
    title: "Visit types",
    singular: "visit type",
    blurb: "Why a patient came in — chosen once, when a visit is opened.",
  },
  {
    key: "encounter-types",
    title: "Encounter types",
    singular: "encounter type",
    blurb: "The kind of clinical interaction recorded inside a visit.",
  },
];

/**
 * Resolve a raw `?register=` value to a known register, falling back to the
 * first one. Validates against the REGISTERS data (the `RegisterKey` type is
 * erased at runtime), so an absent, unknown, or stale key degrades gracefully
 * rather than throwing — the rail is how users navigate between registers.
 */
export function resolveRegister(raw: string): Register {
  return REGISTERS.find((r) => r.key === raw) ?? REGISTERS[0];
}
