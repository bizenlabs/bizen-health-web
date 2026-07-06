import Link from "next/link";
import { PlusIcon } from "@heroicons/react/20/solid";
import { Badge } from "@/components/catalyst/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { requireRole } from "@/lib/auth";
import { listSystemTemplates } from "@/lib/system-templates";
import { CATEGORY_LABEL } from "@/lib/template-categories";
import { specialtyLabel } from "@/lib/template-specialties";

/**
 * The global system-template library — every template distributed to every
 * clinic. Managed rows are owned by the backend code seed and edited in code;
 * authored rows are published from here (or promoted from a tenant template)
 * and are editable in place.
 */
export default async function AdminTemplatesPage() {
  await requireRole("super_admin");

  const templates = await listSystemTemplates();

  return (
    <div className="px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Template library</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            System templates distributed to every clinic. Seed templates are
            owned by the code seed and edited in a deploy; authored templates
            are published here and can be edited, unpublished or republished at
            any time.
          </p>
        </div>
        <Link
          href="/admin/templates/new"
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <PlusIcon className="size-4" />
          Publish template
        </Link>
      </div>

      <Table className="mt-8 [--gutter:--spacing(6)]">
        <TableHead>
          <TableRow>
            <TableHeader>Name</TableHeader>
            <TableHeader>Category</TableHeader>
            <TableHeader>Specialty</TableHeader>
            <TableHeader>Origin</TableHeader>
            <TableHeader>Status</TableHeader>
            <TableHeader className="text-right">Version</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {templates.map((t) => (
            <TableRow key={t.id} href={`/admin/templates/${t.id}`}>
              <TableCell className="font-medium">
                {t.name}
                {t.description ? (
                  <span className="mt-0.5 block max-w-md truncate text-xs font-normal text-zinc-500">
                    {t.description}
                  </span>
                ) : null}
              </TableCell>
              <TableCell>{CATEGORY_LABEL[t.category]}</TableCell>
              <TableCell>{specialtyLabel(t.specialty)}</TableCell>
              <TableCell>
                <Badge color={t.managed ? "zinc" : "blue"}>
                  {t.managed ? "Seed" : "Authored"}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge color={t.active ? "emerald" : "zinc"}>
                  {t.active ? "Published" : "Unpublished"}
                </Badge>
                {t.isDefault ? <Badge color="amber">Default</Badge> : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                v{t.version}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
