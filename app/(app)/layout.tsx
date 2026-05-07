import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { listMemberships, workos } from "@/lib/workos";
import { AppShell } from "@/components/shell/AppShell";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const session = await requireSession();
  // Defense in depth: proxy already enforced these, but Server Actions can
  // bypass the proxy matcher.
  if (!session.organizationId) {
    redirect("/select-org");
  }
  if (session.tenantStatus === "suspended") {
    redirect("/suspended");
  }

  const [memberships, user] = await Promise.all([
    listMemberships(session.userId),
    workos.userManagement.getUser(session.userId),
  ]);

  const current = memberships.find(
    (m) => m.organizationId === session.organizationId,
  );
  const currentOrgName =
    current?.organizationName ?? session.tenantSlug ?? "Workspace";
  const fullName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <AppShell
      currentOrgId={session.organizationId}
      currentOrgName={currentOrgName}
      currentOrgSlug={session.tenantSlug}
      memberships={memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organizationName,
        status: m.status,
      }))}
      isTenantAdmin={session.role === "tenant_admin"}
      user={{ name: fullName, email: user.email }}
    >
      {children}
    </AppShell>
  );
}
