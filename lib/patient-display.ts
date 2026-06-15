import type {
  Gender,
  Name,
  PatientDetail,
  PatientSummary,
} from "@/lib/patients";

// Pure display helpers for patients, shared by server components and client
// components (the patient picker). Type-only imports from the server-only
// `@/lib/patients` are erased at build, so this file stays client-safe.

/** A single-line display name from the structured name parts. */
export function composePatientName(n: Name): string {
  const full = [
    n.prefix,
    n.givenName,
    n.middleName,
    n.familyName,
    n.familyNameSuffix,
  ]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
  return full || "Unnamed patient";
}

const GENDER_SHORT: Record<Gender, string> = {
  MALE: "M",
  FEMALE: "F",
  OTHER: "Other",
  UNKNOWN: "",
};

/** Approximate age in years from a `YYYY-MM-DD` birthdate, or "" if unparseable. */
function ageLabel(birthdate: string): string {
  const year = Number(birthdate.slice(0, 4));
  if (!Number.isFinite(year)) return "";
  const age = new Date().getFullYear() - year;
  return age >= 0 && age < 150 ? `${age}y` : "";
}

/** "F · 34y · MRN-0042" — gender, age and primary identifier, blanks dropped. */
export function patientMeta(
  p: Pick<PatientSummary, "birthdate" | "gender" | "primaryIdentifier">,
): string {
  const bits: string[] = [];
  const g = p.gender && p.gender !== "UNKNOWN" ? GENDER_SHORT[p.gender] : "";
  if (g) bits.push(g);
  if (p.birthdate) {
    const a = ageLabel(p.birthdate);
    if (a) bits.push(a);
  }
  if (p.primaryIdentifier) bits.push(p.primaryIdentifier);
  return bits.join(" · ");
}

/** Collapse a full {@link PatientDetail} to the summary the picker works with. */
export function detailToPatientSummary(d: PatientDetail): PatientSummary {
  const pref =
    d.identifiers.find((i) => i.preferred) ?? d.identifiers[0] ?? null;
  return {
    id: d.id,
    preferredName: composePatientName(d.name),
    birthdate: d.demographics.birthdate,
    birthdateEstimated: d.demographics.birthdateEstimated,
    gender: d.demographics.gender,
    primaryIdentifierType: pref?.typeName ?? null,
    primaryIdentifier: pref?.identifier ?? null,
    dead: d.demographics.dead,
  };
}
