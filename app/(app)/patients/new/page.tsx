import { requireSession } from "@/lib/auth";
import { getIdentifierTypes } from "@/lib/patients";
import { RegisterPatientForm } from "../_components/register-patient-form";

export default async function NewPatientPage() {
  await requireSession();
  const identifierTypes = await getIdentifierTypes();

  return (
    <div className="px-6 py-10">
      <h1 className="text-2xl font-semibold">Register a patient</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Only a name is required. Demographics and identifiers can be added or
        edited later.
      </p>
      <RegisterPatientForm identifierTypes={identifierTypes} />
    </div>
  );
}
