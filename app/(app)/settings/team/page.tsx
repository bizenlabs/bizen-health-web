import { requireRole } from "@/lib/auth";
import { listTenantUsers } from "@/lib/users";
import { listOrgInvitations } from "@/lib/workos";
import { InviteForm } from "./InviteForm";
import { TeamRoster, type PendingInvitation } from "./TeamRoster";

export default async function TeamPage() {
  const session = await requireRole("tenant_admin");
  if (!session.organizationId) {
    throw new Error("No active organization");
  }

  // Members come from bizen-health-core (the `providers` mirror); pending
  // invitations have no core-domain object and are read live from WorkOS.
  const [users, invitations] = await Promise.all([
    listTenantUsers(),
    listOrgInvitations(session.organizationId),
  ]);

  const activeMembers = users.filter((u) => u.status === "active");
  const pendingInvitations: PendingInvitation[] = invitations
    .filter((i) => i.state === "pending")
    .map((i) => ({
      id: i.id,
      email: i.email,
      roleSlug: i.roleSlug ?? null,
      createdAt: i.createdAt,
    }));

  return (
    <div>
      <h1 className="text-2xl font-semibold">Team</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Manage who can access {session.tenantSlug ?? "this workspace"}.
      </p>

      {session.orgType === "individual" ? (
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          You&apos;re set up as an individual account. Inviting your first
          teammate will convert this to a team account.
        </div>
      ) : null}

      <TeamRoster
        initialMembers={activeMembers}
        invitations={pendingInvitations}
        currentUserId={session.userId}
      />

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Invite a teammate
        </h2>
        <InviteForm />
      </section>
    </div>
  );
}
