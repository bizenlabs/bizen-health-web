import { requireRole } from "@/lib/auth";
import { SystemTemplateForm } from "../_components/system-template-form";

export default async function NewSystemTemplatePage() {
  await requireRole("super_admin");

  return (
    <div className="px-6 py-10">
      <h1 className="text-2xl font-semibold">Publish template</h1>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
        Publishing adds this template to the global library — every clinic sees
        it immediately as a read-only system template they can clone. Use
        [placeholder] and (instruction) markers in the body, and{" "}
        {"{{patient.*}}"} variables where patient data should be filled in.
      </p>
      <div className="mt-8">
        <SystemTemplateForm />
      </div>
    </div>
  );
}
