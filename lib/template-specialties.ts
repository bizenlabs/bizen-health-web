/**
 * Template specialty constants — the optional clinical-specialty tag on a
 * template. `null` means general-purpose; the set mirrors the API enum and
 * leans towards the disciplines seen in Indian primary and secondary care.
 *
 * Like `lib/template-categories.ts`, this module is deliberately free of
 * `server-only` so Client Components (filters, editor selects) can use it.
 */

/** Mirrors the API's TemplateSpecialty enum. */
export const TEMPLATE_SPECIALTIES = [
  "GENERAL_PRACTICE",
  "INTERNAL_MEDICINE",
  "PEDIATRICS",
  "OBSTETRICS_GYNECOLOGY",
  "CARDIOLOGY",
  "DERMATOLOGY",
  "ORTHOPEDICS",
  "PSYCHIATRY",
  "OPHTHALMOLOGY",
  "ENT",
  "DENTISTRY",
  "PHYSIOTHERAPY",
  "NUTRITION_DIETETICS",
  "EMERGENCY_MEDICINE",
] as const;

export type TemplateSpecialty = (typeof TEMPLATE_SPECIALTIES)[number];

/** Human label for a specialty — for filters, selects and chips. */
export const SPECIALTY_LABEL: Record<TemplateSpecialty, string> = {
  GENERAL_PRACTICE: "General practice",
  INTERNAL_MEDICINE: "Internal medicine",
  PEDIATRICS: "Pediatrics",
  OBSTETRICS_GYNECOLOGY: "Obstetrics & gynecology",
  CARDIOLOGY: "Cardiology",
  DERMATOLOGY: "Dermatology",
  ORTHOPEDICS: "Orthopedics",
  PSYCHIATRY: "Psychiatry",
  OPHTHALMOLOGY: "Ophthalmology",
  ENT: "ENT",
  DENTISTRY: "Dentistry",
  PHYSIOTHERAPY: "Physiotherapy",
  NUTRITION_DIETETICS: "Nutrition & dietetics",
  EMERGENCY_MEDICINE: "Emergency medicine",
};

/** Label helper that treats the absent tag as "General". */
export const specialtyLabel = (specialty: TemplateSpecialty | null) =>
  specialty ? SPECIALTY_LABEL[specialty] : "General";
