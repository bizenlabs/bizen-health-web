/**
 * GST state codes — the first two digits of a GSTIN, and the "place of supply"
 * that decides whether a sale attracts CGST+SGST (same state as us) or IGST
 * (different state).
 *
 * Pure data, no `server-only`, so the checkout form can render it directly.
 */

export type GstState = { code: string; name: string };

export const GST_STATES: readonly GstState[] = [
  { code: "01", name: "Jammu and Kashmir" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" },
  { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" },
  { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" },
  { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" },
  { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" },
  { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" },
  { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" },
  { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" },
  { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "27", name: "Maharashtra" },
  { code: "29", name: "Karnataka" },
  { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" },
  { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" },
  { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "38", name: "Ladakh" },
  { code: "97", name: "Other Territory" },
] as const;

export function isGstStateCode(code: string): boolean {
  return GST_STATES.some((state) => state.code === code);
}

/**
 * The state a GSTIN belongs to. Its first two digits are the state code, so a
 * mismatch against the selected state is a data-entry error worth catching
 * before an invoice is issued.
 */
export function stateCodeFromGstin(gstin: string): string | null {
  const trimmed = gstin.trim();
  if (trimmed.length !== 15) return null;
  const code = trimmed.slice(0, 2);
  return isGstStateCode(code) ? code : null;
}
