"use client";

import { useState, useTransition } from "react";
import type { TenantUser } from "@/lib/users";
import {
  changeMemberRoleAction,
  removeMemberAction,
  revokeInvitationAction,
} from "./actions";
import { ROLES, roleLabel } from "./roles";

export type PendingInvitation = {
  id: string;
  email: string;
  roleSlug: string | null;
  createdAt: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

/**
 * Client roster for /settings/team. Members come from core's `providers`
 * mirror, which reconciles from WorkOS via webhook — so role changes and
 * removals are applied optimistically here rather than re-fetched, which
 * would race the webhook. Pending invitations are read live from WorkOS and
 * are revalidated by the invite/revoke actions, so they render from props.
 */
export function TeamRoster({
  initialMembers,
  invitations,
  currentUserId,
}: {
  initialMembers: TenantUser[];
  invitations: PendingInvitation[];
  currentUserId: string;
}) {
  const [members, setMembers] = useState(initialMembers);
  const adminCount = members.filter((m) => m.role === "tenant_admin").length;

  function handleRoleChanged(providerId: string, role: string) {
    setMembers((prev) =>
      prev.map((m) => (m.providerId === providerId ? { ...m, role } : m)),
    );
  }

  function handleRemoved(providerId: string) {
    setMembers((prev) => prev.filter((m) => m.providerId !== providerId));
  }

  return (
    <>
      <section className="mt-8">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          Members
        </h2>
        <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {members.map((m) => (
            <MemberRow
              key={m.providerId}
              member={m}
              isSelf={m.workosUserId === currentUserId}
              isSoleAdmin={m.role === "tenant_admin" && adminCount <= 1}
              onRoleChanged={handleRoleChanged}
              onRemoved={handleRemoved}
            />
          ))}
        </ul>
      </section>

      {invitations.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
            Pending invitations
          </h2>
          <ul className="mt-3 divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {invitations.map((inv) => (
              <InvitationRow key={inv.id} invitation={inv} />
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

function MemberRow({
  member,
  isSelf,
  isSoleAdmin,
  onRoleChanged,
  onRemoved,
}: {
  member: TenantUser;
  isSelf: boolean;
  isSoleAdmin: boolean;
  onRoleChanged: (providerId: string, role: string) => void;
  onRemoved: (providerId: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState(member.role ?? "");

  // You can't change or remove yourself, and the last admin must keep the role.
  const locked = isSelf || isSoleAdmin;
  const editable = ROLES.some((r) => r.slug === member.role);
  const name = member.displayName?.trim() || member.email;

  function onRoleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    if (next === role) return;
    const previous = role;
    setError(null);
    setRole(next); // optimistic
    startTransition(async () => {
      const result = await changeMemberRoleAction(member.providerId, next);
      if (result.ok) {
        onRoleChanged(member.providerId, next);
      } else {
        setRole(previous); // revert
        setError(result.error);
      }
    });
  }

  function onRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeMemberAction(member.providerId);
      if (result.ok) {
        onRemoved(member.providerId);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">
            {name}
            {isSelf ? (
              <span className="ml-2 text-xs text-zinc-500">(you)</span>
            ) : null}
          </div>
          <div className="truncate text-xs text-zinc-500">{member.email}</div>
        </div>
        <div className="flex items-center gap-3">
          {editable ? (
            <select
              aria-label={`Role for ${name}`}
              value={role}
              onChange={onRoleSelect}
              disabled={pending || locked}
              className="rounded-md border border-zinc-200 px-2 py-1 text-xs disabled:opacity-50 dark:border-zinc-800 dark:bg-transparent"
            >
              {ROLES.map((r) => (
                <option key={r.slug} value={r.slug}>
                  {r.label}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-zinc-500">
              {roleLabel(member.role)}
            </span>
          )}
          <button
            type="button"
            onClick={onRemove}
            disabled={pending || locked}
            className="text-xs text-red-600 hover:underline disabled:text-zinc-400 disabled:no-underline dark:text-red-400"
          >
            Remove
          </button>
        </div>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
      {isSoleAdmin ? (
        <p className="mt-1 text-xs text-zinc-400">
          Last admin — promote another member before changing this.
        </p>
      ) : null}
    </li>
  );
}

function InvitationRow({ invitation }: { invitation: PendingInvitation }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onRevoke() {
    setError(null);
    startTransition(async () => {
      const result = await revokeInvitationAction(invitation.id);
      // On success the route revalidates and this row drops out.
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{invitation.email}</div>
          <div className="text-xs text-zinc-500">
            {roleLabel(invitation.roleSlug)} · sent{" "}
            {formatDate(invitation.createdAt)}
          </div>
        </div>
        <button
          type="button"
          onClick={onRevoke}
          disabled={pending}
          className="text-xs text-zinc-600 hover:underline disabled:opacity-40 dark:text-zinc-400"
        >
          Revoke
        </button>
      </div>
      {error ? (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </li>
  );
}
