import { requireRole } from "@/lib/auth";
import { TemplateEditor } from "../_components/template-editor";

export default async function NewTemplatePage() {
  await requireRole("tenant_admin", "super_admin");

  return (
    <div className="px-6 py-10">
      <h1 className="text-2xl font-semibold">New template</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Create a Markdown scaffold for a clinical note. You can set it as the
        default for its category once it is saved.
      </p>

      <div className="mt-8">
        <TemplateEditor />
      </div>
    </div>
  );
}
