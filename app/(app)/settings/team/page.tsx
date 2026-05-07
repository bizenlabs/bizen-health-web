import { requireRole } from "@/lib/auth";
import { listOrgInvitations, listOrgMembers, workos } from "@/lib/workos";
import { InviteForm } from "./InviteForm";
import { removeMemberAction, revokeInvitationAction } from "./actions";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export default async function TeamPage() {
  const session = await requireRole("tenant_admin");
  if (!session.organizationId) {
    throw new Error("No active organization");
  }

  const [members, invitations] = await Promise.all([
    listOrgMembers(session.organizationId),
    listOrgInvitations(session.organizationId),
  ]);

  // Hydrate member display info (firstName/lastName) from the WorkOS user
  // record. Members are typically a small number — pagination not needed yet.
  const users = await Promise.all(
    members.map((m) => workos.userManagement.getUser(m.userId)),
  );
  const userById = new Map(users.map((u) => [u.id, u]));

  const pendingInvitations = invitations.filter((i) => i.state === "pending");

  return (
    <div className="px-6 py-10">
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

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Members
        </h2>
        <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {members.map((m) => {
            const u = userById.get(m.userId);
            const name =
              [u?.firstName, u?.lastName].filter(Boolean).join(" ") ||
              u?.email ||
              m.userId;
            const isSelf = m.userId === session.userId;
            return (
              <li
                key={m.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {name}
                    {isSelf ? (
                      <span className="ml-2 text-xs text-zinc-500">(you)</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {u?.email ?? ""} · {m.role.slug} · {m.status}
                  </div>
                </div>
                {!isSelf ? (
                  <form action={removeMemberAction.bind(null, m.id)}>
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      Remove
                    </button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {pendingInvitations.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
            Pending invitations
          </h2>
          <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {pendingInvitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium">{inv.email}</div>
                  <div className="text-xs text-zinc-500">
                    {inv.roleSlug ?? "—"} · sent {formatDate(inv.createdAt)}
                  </div>
                </div>
                <form action={revokeInvitationAction.bind(null, inv.id)}>
                  <button
                    type="submit"
                    className="text-xs text-zinc-600 hover:underline dark:text-zinc-400"
                  >
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Invite a teammate
        </h2>
        <InviteForm />
      </section>
    </div>
  );
}
