import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { listMemberships, workos } from "@/lib/workos";
import { AppShell } from "@/components/shell/AppShell";
import { BillingBanner } from "@/components/billing/BillingBanner";
import { BillingGateProvider } from "@/components/billing/BillingGate";

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
      memberships={memberships.map((m) => ({
        organizationId: m.organizationId,
        organizationName: m.organizationName,
        status: m.status,
      }))}
      user={{ name: fullName, email: user.email }}
    >
      {/* Billing state rides along on the session, so this adds no network
          cost. The banner renders nothing unless there's something to act on,
          and the gate only advises the UI — Spring is the real boundary. */}
      <BillingGateProvider status={session.billingStatus}>
        <BillingBanner
          status={session.billingStatus}
          deadline={session.billingDeadline}
          isAdmin={
            session.role === "tenant_admin" || session.role === "super_admin"
          }
        />
        {children}
      </BillingGateProvider>
    </AppShell>
  );
}
