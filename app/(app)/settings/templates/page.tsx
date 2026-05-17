import { requireRole } from "@/lib/auth";
import { listTemplates } from "@/lib/templates";
import { TemplateBrowser } from "./_components/template-browser";

export default async function TemplatesPage() {
  await requireRole("tenant_admin", "super_admin");

  // Fetch everything including retired rows — the filter bar narrows the list
  // client-side, so the page stays a single round trip.
  const templates = await listTemplates(true);

  return (
    <div className="px-6 py-10">
      <TemplateBrowser templates={templates} />
    </div>
  );
}
