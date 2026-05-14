"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/catalyst/avatar";
import { OrgSwitchingOverlay } from "@/components/shell/OrgSwitchingOverlay";
import {
  Dropdown,
  DropdownButton,
  DropdownDivider,
  DropdownItem,
  DropdownLabel,
  DropdownMenu,
} from "@/components/catalyst/dropdown";
import {
  Navbar,
  NavbarItem,
  NavbarSection,
  NavbarSpacer,
} from "@/components/catalyst/navbar";
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from "@/components/catalyst/sidebar";
import { SidebarLayout } from "@/components/catalyst/sidebar-layout";
import { switchOrgAction } from "@/app/select-org/actions";
import {
  ArrowRightStartOnRectangleIcon,
  ArrowsRightLeftIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  UserCircleIcon,
} from "@heroicons/react/16/solid";
import {
  Cog6ToothIcon,
  HomeIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/20/solid";

type Membership = {
  organizationId: string;
  organizationName: string;
  status: "active" | "inactive" | "pending";
};

type Props = {
  currentOrgId: string;
  currentOrgName: string;
  currentOrgSlug: string | null;
  memberships: Membership[];
  isTenantAdmin: boolean;
  user: {
    name: string;
    email: string;
  };
  children: React.ReactNode;
};

function AccountDropdownMenu({
  anchor,
}: {
  anchor: "top start" | "bottom end";
}) {
  return (
    <DropdownMenu className="min-w-64" anchor={anchor}>
      <DropdownItem href="/settings">
        <UserCircleIcon />
        <DropdownLabel>My account</DropdownLabel>
      </DropdownItem>
      <DropdownItem href="/select-org">
        <ArrowsRightLeftIcon />
        <DropdownLabel>Switch organization</DropdownLabel>
      </DropdownItem>
      <DropdownDivider />
      <DropdownItem href="/sign-out">
        <ArrowRightStartOnRectangleIcon />
        <DropdownLabel>Sign out</DropdownLabel>
      </DropdownItem>
    </DropdownMenu>
  );
}

export function AppShell({
  currentOrgId,
  currentOrgName,
  currentOrgSlug,
  memberships,
  isTenantAdmin,
  user,
  children,
}: Props) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [pendingOrgName, setPendingOrgName] = useState<string | null>(null);

  const otherOrgs = memberships.filter(
    (m) => m.organizationId !== currentOrgId && m.status === "active",
  );

  function handleSwitchOrg(organizationId: string, organizationName: string) {
    setPendingOrgName(organizationName);
    startTransition(async () => {
      // switchOrgAction throws NEXT_REDIRECT on success; React keeps the
      // transition pending through the navigation, so the overlay stays up
      // until the new page renders (and this AppShell remounts).
      await switchOrgAction(organizationId, "/dashboard");
    });
  }

  return (
    <>
      <OrgSwitchingOverlay orgName={isPending ? pendingOrgName : null} />
      <SidebarLayout
        navbar={
          <Navbar>
            <NavbarSpacer />
            <NavbarSection>
              <Dropdown>
                <DropdownButton as={NavbarItem}>
                  <Avatar initials={initials(user.name)} square />
                </DropdownButton>
                <AccountDropdownMenu anchor="bottom end" />
              </Dropdown>
            </NavbarSection>
          </Navbar>
        }
        sidebar={
          <Sidebar>
            <SidebarHeader>
              <Dropdown>
                <DropdownButton as={SidebarItem}>
                  <Avatar
                    initials={initials(currentOrgName)}
                    className={orgAvatarColor(currentOrgId)}
                  />
                  <SidebarLabel>{currentOrgName}</SidebarLabel>
                  <ChevronDownIcon />
                </DropdownButton>
                <DropdownMenu
                  className="min-w-80 lg:min-w-64"
                  anchor="bottom start"
                >
                  <DropdownItem href="/settings">
                    <Cog6ToothIcon />
                    <DropdownLabel>Settings</DropdownLabel>
                  </DropdownItem>
                  {currentOrgSlug ? (
                    <DropdownItem disabled>
                      <DropdownLabel className="text-xs text-zinc-500">
                        {currentOrgSlug}
                      </DropdownLabel>
                    </DropdownItem>
                  ) : null}
                  {otherOrgs.length > 0 ? (
                    <>
                      <DropdownDivider />
                      {otherOrgs.map((m) => (
                        <DropdownItem
                          key={m.organizationId}
                          disabled={isPending}
                          onClick={() => {
                            handleSwitchOrg(
                              m.organizationId,
                              m.organizationName,
                            );
                          }}
                        >
                          <Avatar
                            slot="icon"
                            initials={initials(m.organizationName)}
                            className={orgAvatarColor(m.organizationId)}
                          />
                          <DropdownLabel>{m.organizationName}</DropdownLabel>
                        </DropdownItem>
                      ))}
                    </>
                  ) : null}
                  <DropdownDivider />
                  <DropdownItem href="/select-org">
                    <PlusIcon />
                    <DropdownLabel>Manage organizations</DropdownLabel>
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </SidebarHeader>

            <SidebarBody>
              <SidebarSection>
                <SidebarItem
                  href="/dashboard"
                  current={pathname === "/dashboard"}
                >
                  <HomeIcon />
                  <SidebarLabel>Dashboard</SidebarLabel>
                </SidebarItem>
                <SidebarItem
                  href="/patients"
                  current={pathname.startsWith("/patients")}
                >
                  <UsersIcon />
                  <SidebarLabel>Patients</SidebarLabel>
                </SidebarItem>
                <SidebarItem
                  href="/settings"
                  current={
                    pathname === "/settings" ||
                    (pathname.startsWith("/settings/") &&
                      !pathname.startsWith("/settings/team"))
                  }
                >
                  <Cog6ToothIcon />
                  <SidebarLabel>Settings</SidebarLabel>
                </SidebarItem>
                {isTenantAdmin ? (
                  <SidebarItem
                    href="/settings/team"
                    current={pathname.startsWith("/settings/team")}
                  >
                    <UserGroupIcon />
                    <SidebarLabel>Team</SidebarLabel>
                  </SidebarItem>
                ) : null}
              </SidebarSection>

              <SidebarSpacer />
            </SidebarBody>

            <SidebarFooter className="max-lg:hidden">
              <Dropdown>
                <DropdownButton as={SidebarItem}>
                  <span className="flex min-w-0 items-center gap-3">
                    <Avatar
                      initials={initials(user.name)}
                      className="size-10"
                      square
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">
                        {user.name}
                      </span>
                      <span className="block truncate text-xs/5 font-normal text-zinc-500 dark:text-zinc-400">
                        {user.email}
                      </span>
                    </span>
                  </span>
                  <ChevronUpIcon />
                </DropdownButton>
                <AccountDropdownMenu anchor="top start" />
              </Dropdown>
            </SidebarFooter>
          </Sidebar>
        }
      >
        {children}
      </SidebarLayout>
    </>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Stand-in for a tenant logo: deterministic color from the org id so each
// tenant gets a stable, distinguishable swatch. Keyed off id (not name) so
// renaming the workspace doesn't reshuffle the color.
const ORG_AVATAR_COLORS = [
  "bg-rose-600 text-white",
  "bg-orange-600 text-white",
  "bg-amber-600 text-white",
  "bg-emerald-600 text-white",
  "bg-teal-600 text-white",
  "bg-sky-600 text-white",
  "bg-blue-600 text-white",
  "bg-indigo-600 text-white",
  "bg-violet-600 text-white",
  "bg-fuchsia-600 text-white",
] as const;

function orgAvatarColor(orgId: string): string {
  let hash = 0;
  for (let i = 0; i < orgId.length; i++) {
    hash = (hash * 31 + orgId.charCodeAt(i)) | 0;
  }
  return ORG_AVATAR_COLORS[Math.abs(hash) % ORG_AVATAR_COLORS.length];
}
