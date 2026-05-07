import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listMemberships } from "@/lib/workos";
import { OrgSwitcher } from "@/components/shell/OrgSwitcher";

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

  const memberships = await listMemberships(session.userId);

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="font-semibold">
            Bizen
          </Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/settings">Settings</Link>
          {session.role === "tenant_admin" ? (
            <Link href="/settings/team">Team</Link>
          ) : null}
        </nav>
        <OrgSwitcher
          currentOrgId={session.organizationId}
          currentOrgSlug={session.tenantSlug}
          memberships={memberships.map((m) => ({
            organizationId: m.organizationId,
            organizationName: m.organizationName,
            status: m.status,
          }))}
        />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
