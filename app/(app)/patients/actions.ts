"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  addPatientIdentifier,
  registerPatient,
  setPreferredPatientIdentifier,
  updatePatient,
  voidPatientIdentifier,
  type Address,
  type Gender,
  type RegisterPatientInput,
  type UpdatePatientInput,
} from "@/lib/patients";
import { ApiError } from "@/lib/api";

const VALID_GENDERS: ReadonlySet<Gender> = new Set([
  "MALE",
  "FEMALE",
  "OTHER",
  "UNKNOWN",
]);

// Shape only — defined in the client component since "use server" files can
// only export async functions. See app/(app)/patients/_components/register-patient-form.tsx.
type RegisterPatientFormState = {
  error: string | null;
  fieldErrors: Record<string, string>;
};

export async function registerPatientAction(
  _prev: RegisterPatientFormState,
  formData: FormData,
): Promise<RegisterPatientFormState> {
  // Server actions bypass the proxy matcher — re-verify auth.
  await requireSession();

  const givenName = (formData.get("givenName") ?? "").toString().trim();
  const familyName = (formData.get("familyName") ?? "").toString().trim();
  const middleName = (formData.get("middleName") ?? "").toString().trim();

  if (!givenName && !familyName) {
    return {
      error: "Provide at least a given name or family name.",
      fieldErrors: { givenName: "Required if family name is blank" },
    };
  }

  const genderRaw = (formData.get("gender") ?? "").toString().trim();
  const gender: Gender | null = VALID_GENDERS.has(genderRaw as Gender)
    ? (genderRaw as Gender)
    : null;

  const useEstimatedAge = formData.get("useEstimatedAge") === "on";
  const ageStr = (formData.get("estimatedAge") ?? "").toString().trim();
  const birthdateStr = (formData.get("birthdate") ?? "").toString().trim();

  let birthdate: string | null = null;
  let birthdateEstimated = false;
  if (useEstimatedAge && ageStr) {
    const age = Number(ageStr);
    if (Number.isFinite(age) && age >= 0 && age <= 130) {
      const today = new Date();
      const year = today.getFullYear() - Math.floor(age);
      birthdate = `${year}-01-01`;
      birthdateEstimated = true;
    } else {
      return {
        error: "Estimated age must be between 0 and 130.",
        fieldErrors: { estimatedAge: "Out of range" },
      };
    }
  } else if (birthdateStr) {
    birthdate = birthdateStr;
    birthdateEstimated = false;
  }

  const identifierTypeId = (formData.get("identifierTypeId") ?? "").toString();
  const identifierValue = (formData.get("identifierValue") ?? "")
    .toString()
    .trim();
  const identifiers =
    identifierTypeId && identifierValue
      ? [
          {
            typeId: identifierTypeId,
            value: identifierValue,
            preferred: true,
          },
        ]
      : [];

  const body: RegisterPatientInput = {
    demographics: {
      gender,
      birthdate,
      birthdateEstimated,
      birthtime: null,
    },
    name: {
      givenName: givenName || null,
      middleName: middleName || null,
      familyName: familyName || null,
    },
    address: extractAddress(formData),
    identifiers,
  };

  let createdId: string;
  try {
    const created = await registerPatient(body);
    createdId = created.id;
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        error: err.message || "Failed to register patient",
        fieldErrors: Object.fromEntries(
          err.fields.map((f) => [f.path, f.message]),
        ),
      };
    }
    return { error: "Failed to register patient", fieldErrors: {} };
  }

  revalidatePath("/patients");
  redirect(`/patients/${createdId}`);
}

export async function updatePatientAction(
  patientId: string,
  _prev: RegisterPatientFormState,
  formData: FormData,
): Promise<RegisterPatientFormState> {
  await requireSession();

  const givenName = (formData.get("givenName") ?? "").toString().trim();
  const familyName = (formData.get("familyName") ?? "").toString().trim();
  const middleName = (formData.get("middleName") ?? "").toString().trim();

  if (!givenName && !familyName) {
    return {
      error: "Provide at least a given name or family name.",
      fieldErrors: { givenName: "Required if family name is blank" },
    };
  }

  const genderRaw = (formData.get("gender") ?? "").toString().trim();
  const gender: Gender | null = VALID_GENDERS.has(genderRaw as Gender)
    ? (genderRaw as Gender)
    : null;

  const useEstimatedAge = formData.get("useEstimatedAge") === "on";
  const ageStr = (formData.get("estimatedAge") ?? "").toString().trim();
  const birthdateStr = (formData.get("birthdate") ?? "").toString().trim();

  let birthdate: string | null = null;
  let birthdateEstimated = false;
  if (useEstimatedAge && ageStr) {
    const age = Number(ageStr);
    if (Number.isFinite(age) && age >= 0 && age <= 130) {
      const today = new Date();
      const year = today.getFullYear() - Math.floor(age);
      birthdate = `${year}-01-01`;
      birthdateEstimated = true;
    } else {
      return {
        error: "Estimated age must be between 0 and 130.",
        fieldErrors: { estimatedAge: "Out of range" },
      };
    }
  } else if (birthdateStr) {
    birthdate = birthdateStr;
    birthdateEstimated = false;
  }

  const body: UpdatePatientInput = {
    demographics: {
      gender,
      birthdate,
      birthdateEstimated,
      birthtime: null,
    },
    name: {
      givenName: givenName || null,
      middleName: middleName || null,
      familyName: familyName || null,
    },
    address: extractAddress(formData),
  };

  try {
    await updatePatient(patientId, body);
  } catch (err) {
    if (err instanceof ApiError) {
      return {
        error: err.message || "Failed to update patient",
        fieldErrors: Object.fromEntries(
          err.fields.map((f) => [f.path, f.message]),
        ),
      };
    }
    return { error: "Failed to update patient", fieldErrors: {} };
  }

  revalidatePath(`/patients/${patientId}`);
  revalidatePath("/patients");
  redirect(`/patients/${patientId}`);
}

type IdentifierActionState = { error: string | null };
const IDENTIFIER_OK: IdentifierActionState = { error: null };

export async function addIdentifierAction(
  patientId: string,
  _prev: IdentifierActionState,
  formData: FormData,
): Promise<IdentifierActionState> {
  await requireSession();
  const typeId = (formData.get("typeId") ?? "").toString();
  const value = (formData.get("value") ?? "").toString().trim();
  const preferred = formData.get("preferred") === "on";
  if (!typeId || !value) {
    return { error: "Type and value are both required." };
  }
  try {
    await addPatientIdentifier(patientId, { typeId, value, preferred });
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message };
    return { error: "Failed to add identifier" };
  }
  revalidatePath(`/patients/${patientId}`);
  return IDENTIFIER_OK;
}

export async function voidIdentifierAction(
  patientId: string,
  identifierId: string,
): Promise<void> {
  await requireSession();
  try {
    await voidPatientIdentifier(patientId, identifierId);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to void identifier");
  }
  revalidatePath(`/patients/${patientId}`);
}

export async function setPreferredIdentifierAction(
  patientId: string,
  identifierId: string,
): Promise<void> {
  await requireSession();
  try {
    await setPreferredPatientIdentifier(patientId, identifierId);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new Error("Failed to promote identifier");
  }
  revalidatePath(`/patients/${patientId}`);
}

function extractAddress(formData: FormData): Address | null {
  const fields: (keyof Address)[] = [
    "address1",
    "address2",
    "address3",
    "cityVillage",
    "countyDistrict",
    "stateProvince",
    "country",
    "postalCode",
    "latitude",
    "longitude",
  ];
  const values = fields.map(
    (k) => (formData.get(k) ?? "").toString().trim() || null,
  );
  if (values.every((v) => v === null)) return null;
  const a = {} as Address;
  fields.forEach((k, i) => {
    a[k] = values[i];
  });
  return a;
}
