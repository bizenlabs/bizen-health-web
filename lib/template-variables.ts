import type { Gender, PatientSummary } from "@/lib/patients";

/**
 * Template variables — deterministic `{{...}}` markers filled from the selected
 * patient (and the current date) when a template is used in a dictation. They
 * differ from the other two template markers:
 *
 *   {{patient.name}}  variable    — replaced with real data
 *   [placeholder]     AI fill     — the model fills this in
 *   (instruction)     guidance    — authoring note, not kept
 *
 * `{{...}}` was chosen because it appears nowhere in template bodies or the
 * `[...]`/`(...)` marker parsers, so it can't collide.
 *
 * Resolution runs client-side in the dictation editor — at seed time and again
 * whenever the patient is linked or changed — so a patient added *after* the
 * dictation has started still fills the markers (see `resolveTemplateVariables`
 * callers in `dictation-editor.tsx`).
 *
 * Two missing-data cases, deliberately different:
 *  - No patient linked yet → `patient.*` markers are LEFT in place, so they can
 *    be filled once a patient is chosen. (`date.today` still resolves.)
 *  - Patient linked but a field is empty (e.g. no birthdate) → that marker is
 *    removed entirely. A dictation note never shows an unresolved token.
 *
 * This module is free of `server-only` (the type-only import from
 * `@/lib/patients` is erased at build) so Client Components can use it.
 */

export type TemplateVariable = {
  /** The dotted key inside the braces, e.g. `patient.name`. */
  key: string;
  /** The full marker as authored, e.g. `{{patient.name}}`. */
  token: string;
  /** Human label for the editor legend / preview chip. */
  label: string;
};

export const TEMPLATE_VARIABLES: TemplateVariable[] = [
  { key: "patient.name", token: "{{patient.name}}", label: "Patient name" },
  { key: "patient.age", token: "{{patient.age}}", label: "Patient age" },
  { key: "patient.sex", token: "{{patient.sex}}", label: "Patient sex" },
  { key: "patient.dob", token: "{{patient.dob}}", label: "Date of birth" },
  { key: "patient.id", token: "{{patient.id}}", label: "Patient ID / MRN" },
  { key: "patient.phone", token: "{{patient.phone}}", label: "Patient phone" },
  { key: "date.today", token: "{{date.today}}", label: "Today’s date" },
  { key: "org.name", token: "{{org.name}}", label: "Organization name" },
  {
    key: "org.address",
    token: "{{org.address}}",
    label: "Organization address",
  },
  { key: "org.phone", token: "{{org.phone}}", label: "Organization phone" },
  { key: "org.email", token: "{{org.email}}", label: "Organization email" },
  {
    key: "org.website",
    token: "{{org.website}}",
    label: "Organization website",
  },
  {
    key: "org.tagline",
    token: "{{org.tagline}}",
    label: "Organization tagline",
  },
  {
    key: "org.registrationNo",
    token: "{{org.registrationNo}}",
    label: "Registration / license no.",
  },
  { key: "org.taxId", token: "{{org.taxId}}", label: "GSTIN / tax ID" },
];

const LABEL_BY_KEY = new Map(TEMPLATE_VARIABLES.map((v) => [v.key, v.label]));

/** True if `key` (the text between the braces) is a known variable. */
export function isKnownVariable(key: string): boolean {
  return LABEL_BY_KEY.has(key.trim());
}

/** Display label for a known variable key, or the key itself if unknown. */
export function variableLabel(key: string): string {
  return LABEL_BY_KEY.get(key.trim()) ?? key.trim();
}

/** True if `text` contains at least one known `{{...}}` variable marker. */
export function containsKnownVariable(text: string): boolean {
  const re = /\{\{\s*([\w.]+)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (isKnownVariable(m[1])) return true;
  }
  return false;
}

/**
 * Matches a `{{ key }}` marker and any single space immediately before it, so a
 * removed (missing) variable doesn't leave a double space. Captures the key.
 */
export const VARIABLE_PATTERN = / ?\{\{\s*([\w.]+)\s*\}\}/g;

/** The minimal patient fields the variables need — available from a summary. */
export type PatientVarSource = {
  name: string | null;
  birthdate: string | null;
  gender: Gender | null;
  identifier: string | null;
  phone: string | null;
};

/**
 * The organization-branding fields the `org.*` variables need. `name` is the
 * effective display name (the clinic's chosen name, falling back to its
 * registered workspace name); every other field is optional.
 *
 * Unlike `patient.*`, org data is always available server-side, so `org.*`
 * markers resolve unconditionally at seed time (like `date.today`) — a
 * per-field empty value drops just that marker.
 */
export type OrgVarSource = {
  name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tagline: string | null;
  registrationNo: string | null;
  taxId: string | null;
};

/** Build a variable source from a patient summary, or null if no patient. */
export function patientVarsFromSummary(
  p: PatientSummary | null,
): PatientVarSource | null {
  if (!p) return null;
  return {
    name:
      p.preferredName && p.preferredName !== "Unnamed patient"
        ? p.preferredName
        : null,
    birthdate: p.birthdate,
    gender: p.gender,
    identifier: p.primaryIdentifier,
    phone: p.phoneNumber,
  };
}

const GENDER_LABEL: Record<Gender, string | null> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  UNKNOWN: null,
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "1990-01-15" → "15 Jan 1990"; null if not a parseable Y-M-D date. */
function formatYmd(value: string | null): string | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = MONTHS[Number(mo) - 1];
  if (!month) return null;
  return `${Number(d)} ${month} ${y}`;
}

/** Whole years from a Y-M-D birthdate as of `now`; null if missing/implausible. */
function ageYears(birthdate: string | null, now: Date): string | null {
  const m = birthdate && /^(\d{4})-(\d{2})-(\d{2})/.exec(birthdate);
  if (!m) return null;
  const [, y, mo, d] = m.map(Number);
  let age = now.getFullYear() - y;
  const beforeBirthday =
    now.getMonth() + 1 < mo || (now.getMonth() + 1 === mo && now.getDate() < d);
  if (beforeBirthday) age--;
  return age >= 0 && age < 150 ? String(age) : null;
}

function toYmd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Resolve one variable key to its value, or null when the data is missing. */
function resolveValue(
  key: string,
  patient: PatientVarSource | null,
  org: OrgVarSource | null,
  now: Date,
): string | null {
  if (key === "date.today") return formatYmd(toYmd(now));
  if (key.startsWith("org.")) {
    if (!org) return null;
    switch (key) {
      case "org.name":
        return org.name;
      case "org.address":
        return org.address;
      case "org.phone":
        return org.phone;
      case "org.email":
        return org.email;
      case "org.website":
        return org.website;
      case "org.tagline":
        return org.tagline;
      case "org.registrationNo":
        return org.registrationNo;
      case "org.taxId":
        return org.taxId;
      default:
        return null;
    }
  }
  if (!patient) return null;
  switch (key) {
    case "patient.name":
      return patient.name;
    case "patient.age":
      return ageYears(patient.birthdate, now);
    case "patient.sex":
      return patient.gender ? GENDER_LABEL[patient.gender] : null;
    case "patient.dob":
      return formatYmd(patient.birthdate);
    case "patient.id":
      return patient.identifier;
    case "patient.phone":
      return patient.phone;
    default:
      return null;
  }
}

/**
 * Replace every `{{...}}` variable in `content`:
 *  - known key with data        → its value;
 *  - known key, patient linked, no value → removed (with one leading space);
 *  - `patient.*` with no patient linked  → left in place (filled later);
 *  - `org.*` with no org source passed   → left in place (filled later);
 *  - unknown key                → left untouched (an author's typo stays visible).
 *
 * `now` is injectable for deterministic tests.
 */
export function resolveTemplateVariables(
  content: string,
  ctx: {
    patient: PatientVarSource | null;
    org?: OrgVarSource | null;
    now?: Date;
  },
): string {
  const now = ctx.now ?? new Date();
  const org = ctx.org ?? null;
  return content.replace(VARIABLE_PATTERN, (match, rawKey: string) => {
    const key = rawKey.trim();
    if (!isKnownVariable(key)) return match;
    // No patient yet: keep patient markers so they can be filled once one is set.
    if (ctx.patient === null && key.startsWith("patient.")) return match;
    // No org source passed (e.g. the patient-change rewrite): keep org markers,
    // which were already resolved against the org at seed time.
    if (org === null && key.startsWith("org.")) return match;
    const value = resolveValue(key, ctx.patient, org, now);
    if (value === null) return ""; // missing → drop the marker (and its space)
    // Preserve a leading space the pattern may have swallowed.
    return match.startsWith(" ") ? ` ${value}` : value;
  });
}
