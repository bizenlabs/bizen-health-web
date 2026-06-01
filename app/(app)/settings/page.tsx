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
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold">General</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Basic details about your workspace and how it&apos;s identified.
      </p>

      <GeneralSection
        orgName={org.name}
        organizationId={session.organizationId}
        orgType={session.orgType}
        isAdmin={isAdmin}
      />
    </div>
  );
}
