"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import {
  registerPatient,
  type Gender,
  type RegisterPatientInput,
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
