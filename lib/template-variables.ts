import type { Gender, PatientDetail } from "@/lib/patients";
import { composePatientName } from "@/lib/patient-display";

/**
 * Template variables — deterministic `{{...}}` markers that are filled from the
 * selected patient (and the current date) when a template is seeded into a
 * dictation. They differ from the other two template markers:
 *
 *   {{patient.name}}  variable    — replaced with real data at dictation time
 *   [placeholder]     AI fill     — the model fills this in
 *   (instruction)     guidance    — authoring note, not kept
 *
 * `{{...}}` was chosen because it appears nowhere in template bodies or the
 * `[...]`/`(...)` marker parsers, so it can't collide.
 *
 * This module is deliberately free of `server-only` (the type-only import from
 * `@/lib/patients` is erased at build) so the Client Component template editor
 * can list the available variables and the preview can highlight them. The
 * resolver is a pure function; it runs server-side at the dictation seed step.
 *
 * Missing-data rule: when a variable can't be resolved (e.g. no birthdate, so
 * age is unknown — common with sparse records), the marker is removed entirely.
 * A dictation note only ever shows real data, never an unresolved token.
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
  { key: "date.today", token: "{{date.today}}", label: "Today’s date" },
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

/**
 * Matches a `{{ key }}` marker and any single space immediately before it, so a
 * removed (missing) variable doesn't leave a double space. Captures the key.
 */
export const VARIABLE_PATTERN = / ?\{\{\s*([\w.]+)\s*\}\}/g;

/** Just the marker, no leading-space capture — for the preview tokenizer. */
export const VARIABLE_TOKEN = /\{\{[\s\w.]+\}\}/;

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

function preferredIdentifier(p: PatientDetail): string | null {
  const pref = p.identifiers.find((i) => i.preferred) ?? p.identifiers[0];
  return pref?.identifier ?? null;
}

/** Resolve one variable key to its value, or null when the data is missing. */
function resolveValue(
  key: string,
  patient: PatientDetail | null,
  now: Date,
): string | null {
  if (key === "date.today") return formatYmd(toYmd(now));
  if (!patient) return null;
  switch (key) {
    case "patient.name": {
      const name = composePatientName(patient.name);
      return name === "Unnamed patient" ? null : name;
    }
    case "patient.age":
      return ageYears(patient.demographics.birthdate, now);
    case "patient.sex":
      return patient.demographics.gender
        ? GENDER_LABEL[patient.demographics.gender]
        : null;
    case "patient.dob":
      return formatYmd(patient.demographics.birthdate);
    case "patient.id":
      return preferredIdentifier(patient);
    default:
      return null;
  }
}

function toYmd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Replace every `{{...}}` variable in `content`:
 *  - known key with data  → its value;
 *  - known key, no data    → removed (with one leading space);
 *  - unknown key           → left untouched (so an author's typo stays visible).
 *
 * `now` is injectable for deterministic tests.
 */
export function resolveTemplateVariables(
  content: string,
  ctx: { patient: PatientDetail | null; now?: Date },
): string {
  const now = ctx.now ?? new Date();
  return content.replace(VARIABLE_PATTERN, (match, rawKey: string) => {
    const key = rawKey.trim();
    if (!isKnownVariable(key)) return match;
    const value = resolveValue(key, ctx.patient, now);
    if (value === null) return ""; // missing → drop the marker (and its space)
    // Preserve a leading space the pattern may have swallowed.
    return match.startsWith(" ") ? ` ${value}` : value;
  });
}
