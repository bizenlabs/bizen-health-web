import { notFound } from "next/navigation";
import { LockClosedIcon } from "@heroicons/react/20/solid";
import { Badge } from "@/components/catalyst/badge";
import { ApiError } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getSystemTemplate, type SystemTemplate } from "@/lib/system-templates";
import { CATEGORY_LABEL } from "@/lib/template-categories";
import { specialtyLabel } from "@/lib/template-specialties";
import {
  PublishStatusToggle,
  SystemTemplateForm,
} from "../_components/system-template-form";

export default async function SystemTemplatePage({
  params,
}: PageProps<"/admin/templates/[id]">) {
  await requireRole("super_admin");

  const { id } = await params;

  let template: SystemTemplate;
  try {
    template = await getSystemTemplate(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return (
    <div className="px-6 py-10">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">{template.name}</h1>
        <Badge color={template.managed ? "zinc" : "blue"}>
          {template.managed ? "Seed" : "Authored"}
        </Badge>
        <Badge color={template.active ? "emerald" : "zinc"}>
          {template.active ? "Published" : "Unpublished"}
        </Badge>
        {!template.managed ? (
          <div className="ml-auto">
            <PublishStatusToggle template={template} />
          </div>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        {CATEGORY_LABEL[template.category]} ·{" "}
        {specialtyLabel(template.specialty)} · version {template.version}
      </p>

      <div className="mt-8">
        {template.managed ? (
          <ManagedTemplateView template={template} />
        ) : (
          <SystemTemplateForm template={template} />
        )}
      </div>
    </div>
  );
}

/**
 * Read-only view of a seed-managed template. Its source of truth is
 * `DefaultTemplates.java` — the seeder reconciles the row on every deploy, so a
 * database edit here would be silently overwritten.
 */
function ManagedTemplateView({ template }: { template: SystemTemplate }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <LockClosedIcon
          className="mt-0.5 size-5 shrink-0 text-zinc-400"
          aria-hidden="true"
        />
        <div>
          <p className="font-medium text-zinc-700 dark:text-zinc-200">
            Owned by the code seed — read-only here
          </p>
          <p className="mt-0.5 text-zinc-500 dark:text-zinc-400">
            This template is reconciled from{" "}
            <code className="font-mono text-xs">DefaultTemplates.java</code> on
            every deploy. Edit it there; a change lands on all clinics with the
            next release.
          </p>
        </div>
      </div>

      <div
        className={
          template.exampleOutput ? "grid gap-4 lg:grid-cols-2" : undefined
        }
      >
        <div>
          <span className="mb-1 block text-xs font-medium text-zinc-500">
            Template body
          </span>
          <pre className="max-h-[32rem] overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs whitespace-pre-wrap dark:border-zinc-800 dark:bg-zinc-900/40">
            {template.content ?? ""}
          </pre>
        </div>
        {template.exampleOutput ? (
          <div>
            <span className="mb-1 block text-xs font-medium text-zinc-500">
              Example output
            </span>
            <pre className="max-h-[32rem] overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 font-mono text-xs whitespace-pre-wrap dark:border-zinc-800 dark:bg-zinc-900/40">
              {template.exampleOutput}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  );
}
