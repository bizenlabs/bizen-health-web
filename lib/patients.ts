import "server-only";
import { api } from "@/lib/api";

export type Gender = "MALE" | "FEMALE" | "OTHER" | "UNKNOWN";
export type AllergyStatus = "UNKNOWN" | "NO_KNOWN_ALLERGIES" | "SEE_LIST";

export type IdentifierType = {
  id: string;
  name: string;
  description: string | null;
  formatRegex: string | null;
  required: boolean;
};

export type PatientIdentifier = {
  id: string;
  typeId: string;
  typeName: string;
  identifier: string;
  preferred: boolean;
};

export type PatientSummary = {
  id: string;
  preferredName: string;
  birthdate: string | null;
  birthdateEstimated: boolean;
  gender: Gender | null;
  primaryIdentifierType: string | null;
  primaryIdentifier: string | null;
  dead: boolean;
};

export type Demographics = {
  gender: Gender | null;
  birthdate: string | null;
  birthdateEstimated: boolean;
  birthtime: string | null;
  dead: boolean;
};

export type Name = {
  prefix: string | null;
  givenName: string | null;
  middleName: string | null;
  familyNamePrefix: string | null;
  familyName: string | null;
  familyName2: string | null;
  familyNameSuffix: string | null;
  degree: string | null;
};

export type Address = {
  address1: string | null;
  address2: string | null;
  address3: string | null;
  cityVillage: string | null;
  countyDistrict: string | null;
  stateProvince: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: string | null;
  longitude: string | null;
};

export type PatientDetail = {
  id: string;
  demographics: Demographics;
  name: Name;
  address: Address;
  allergyStatus: AllergyStatus;
  identifiers: PatientIdentifier[];
  deathDate: string | null;
  deathdateEstimated: boolean;
  causeOfDeath: string | null;
  voided: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PageResponse<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type RegisterPatientInput = {
  demographics: {
    gender: Gender | null;
    birthdate: string | null;
    birthdateEstimated: boolean;
    birthtime: string | null;
  } | null;
  name: {
    prefix?: string | null;
    givenName?: string | null;
    middleName?: string | null;
    familyNamePrefix?: string | null;
    familyName?: string | null;
    familyName2?: string | null;
    familyNameSuffix?: string | null;
    degree?: string | null;
  };
  address?: Address | null;
  identifiers?: { typeId: string; value: string; preferred: boolean }[];
};

// Section-level partial update: each top-level field is optional. When
// present, the sub-object fully replaces that section on the aggregate;
// any field omitted within a present sub-object lands as null. Identifiers
// and death are managed via separate endpoints (not exposed yet).
export type UpdatePatientInput = {
  demographics?: RegisterPatientInput["demographics"];
  name?: RegisterPatientInput["name"];
  address?: Address | null;
};

export const listPatients = (p: { page?: number; size?: number } = {}) =>
  api<PageResponse<PatientSummary>>(
    `/v1/patients?page=${p.page ?? 0}&size=${p.size ?? 50}`,
  );

export const getPatient = (id: string) =>
  api<PatientDetail>(`/v1/patients/${id}`);

export const registerPatient = (body: RegisterPatientInput) =>
  api<PatientDetail>(`/v1/patients`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updatePatient = (id: string, body: UpdatePatientInput) =>
  api<PatientDetail>(`/v1/patients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const getIdentifierTypes = () =>
  api<IdentifierType[]>(`/v1/patient-identifier-types`);
