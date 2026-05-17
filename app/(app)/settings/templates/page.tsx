import Link from "next/link";
import { requireRole } from "@/lib/auth";
import {
  CATEGORY_LABEL,
  listTemplates,
  TEMPLATE_CATEGORIES,
  type TemplateSummary,
} from "@/lib/templates";
import { TemplateList } from "./_components/template-list";

function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function TemplatesPage({
  searchParams,
}: PageProps<"/settings/templates">) {
  await requireRole("tenant_admin", "super_admin");

  const showRetired = one((await searchParams).includeRetired) === "true";
  const templates = await listTemplates(showRetired);

  // Group by category so the page reads as note-type sections; categories with
  // no templates are dropped.
  const byCategory = TEMPLATE_CATEGORIES.map((category) => ({
    category,
    items: templates.filter((t) => t.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Note templates</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Reusable Markdown scaffolds for clinical notes. Each tenant starts
            with editable defaults; one template per category is the default.
          </p>
        </div>
        <Link
          href="/settings/templates/new"
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          New template
        </Link>
      </div>

      <div className="mt-4 flex justify-end">
        <Link
          href={
            showRetired
              ? "/settings/templates"
              : "/settings/templates?includeRetired=true"
          }
          className="text-sm text-zinc-500 hover:text-zinc-700 hover:underline dark:hover:text-zinc-300"
        >
          {showRetired ? "Hide retired" : "Show retired"}
        </Link>
      </div>

      {byCategory.length === 0 ? (
        <p className="mt-10 text-sm text-zinc-500">No templates yet.</p>
      ) : (
        byCategory.map((group) => (
          <CategorySection
            key={group.category}
            label={CATEGORY_LABEL[group.category]}
            items={group.items}
          />
        ))
      )}
    </div>
  );
}

function CategorySection({
  label,
  items,
}: {
  label: string;
  items: TemplateSummary[];
}) {
  return (
    <section className="mt-10 first-of-type:mt-8">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
        {label}
      </h2>
      <TemplateList items={items} />
    </section>
  );
}
