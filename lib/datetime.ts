/**
 * Clinic timezone helpers. The backend stores appointment times as instants;
 * the clinic operates in a single fixed zone (ADR-0010 — Asia/Kolkata). These
 * helpers keep every rendered/submitted time in clinic-local terms so a booking
 * never silently shows in the browser's zone.
 *
 * Safe to import from both client and server components (no `server-only`).
 */

export const CLINIC_TZ = "Asia/Kolkata";

// Asia/Kolkata is a fixed +05:30 offset (no DST).
const CLINIC_OFFSET = "+05:30";

/** Today's date in the clinic zone, as `YYYY-MM-DD`. */
export function todayClinicISODate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Convert a clinic-local wall date + time to an ISO instant string the backend
 * parses correctly. `date` is `YYYY-MM-DD`, `time` is `HH:mm` or `HH:mm:ss`.
 */
export function clinicLocalToInstant(date: string, time: string): string {
  const t = time.length === 5 ? `${time}:00` : time;
  return `${date}T${t}${CLINIC_OFFSET}`;
}

/** The clinic-local `YYYY-MM-DD` of an instant — for prefilling date inputs. */
export function clinicDateOf(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/** The clinic-local 24h `HH:mm` of an instant — for prefilling time inputs. */
export function clinicTimeOf(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function fmt(iso: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: CLINIC_TZ,
    ...opts,
  }).format(new Date(iso));
}

/** e.g. "15 May 2026, 9:00 am" — clinic zone. */
export function formatClinicDateTime(iso: string): string {
  return fmt(iso, { dateStyle: "medium", timeStyle: "short" });
}

/** e.g. "15 May 2026" — clinic zone. */
export function formatClinicDate(iso: string): string {
  return fmt(iso, { dateStyle: "medium" });
}

/** e.g. "9:00 am" — clinic zone. */
export function formatClinicTime(iso: string): string {
  return fmt(iso, { timeStyle: "short" });
}
