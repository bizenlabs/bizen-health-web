import { requireSession } from "@/lib/auth";
import { workos } from "@/lib/workos";
import { GeneralSection } from "./GeneralSection";

export default async function Settings() {
  const session = await requireSession();
  if (!session.organizationId) {
    throw new Error("No active organization");
  }

  const org = await workos.organizations.getOrganization(
    session.organizationId,
  );
  const isAdmin = session.role === "tenant_admin";

  return (
    <div className="px-6 py-10">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Manage your workspace.
      </p>

      <GeneralSection
        orgName={org.name}
        tenantSlug={session.tenantSlug}
        organizationId={session.organizationId}
        orgType={session.orgType}
        isAdmin={isAdmin}
      />
    </div>
  );
}
