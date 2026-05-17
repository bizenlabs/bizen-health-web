import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import {
  CATEGORY_LABEL,
  getTemplate,
  listTemplateVersions,
  type TemplateDetail,
  type TemplateVersion,
} from "@/lib/templates";
import { TemplateEditor } from "../_components/template-editor";

export default async function EditTemplatePage({
  params,
}: PageProps<"/settings/templates/[id]">) {
  await requireRole("tenant_admin", "super_admin");

  const { id } = await params;

  let template: TemplateDetail;
  let versions: TemplateVersion[];
  try {
    [template, versions] = await Promise.all([
      getTemplate(id),
      listTemplateVersions(id),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="px-6 py-10">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">{template.name}</h1>
        {template.retired ? (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            retired
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {CATEGORY_LABEL[template.category]} · version {template.version}
        {template.isDefault ? " · default for its category" : ""}
      </p>

      <div className="mt-8">
        <TemplateEditor template={template} versions={versions} />
      </div>
    </div>
  );
}
