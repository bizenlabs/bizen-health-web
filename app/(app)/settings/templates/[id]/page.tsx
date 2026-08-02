import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api";
import { hasRole, requireRole } from "@/lib/auth";
import {
  CATEGORY_LABEL,
  getTemplate,
  listTemplateVersions,
  specialtyLabel,
  type TemplateDetail,
  type TemplateVersion,
} from "@/lib/templates";
import { PromoteButton } from "../_components/promote-button";
import { SystemTemplateView } from "../_components/system-template-view";
import { TemplateEditor } from "../_components/template-editor";

export default async function EditTemplatePage({
  params,
}: PageProps<"/settings/templates/[id]">) {
  await requireRole("tenant_admin", "super_admin");

  const { id } = await params;

  let template: TemplateDetail;
  try {
    template = await getTemplate(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // System templates are read-only and carry no per-row version history;
  // only fetch versions for the editable tenant case.
  let versions: TemplateVersion[] = [];
  if (template.editable) {
    versions = await listTemplateVersions(id);
  }

  // Promoting into the global library is a platform-operator action.
  const canPromote =
    template.source === "TENANT" &&
    !template.retired &&
    (await hasRole("super_admin"));

  return (
    <div className="px-6 py-10">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">{template.name}</h1>
        {template.source === "SYSTEM" ? (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            system
          </span>
        ) : null}
        {template.retired ? (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            inactive
          </span>
        ) : null}
        {canPromote ? (
          <div className="ml-auto">
            <PromoteButton
              templateId={template.id}
              templateName={template.name}
            />
          </div>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {CATEGORY_LABEL[template.category]} ·{" "}
        {specialtyLabel(template.specialty)} · version {template.version}
        {template.effectiveDefault ? " · default for its category" : ""}
      </p>

      <div className="mt-8">
        {template.editable ? (
          <TemplateEditor template={template} versions={versions} />
        ) : (
          <SystemTemplateView template={template} />
        )}
      </div>
    </div>
  );
}
