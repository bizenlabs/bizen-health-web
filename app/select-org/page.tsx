import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { listMemberships } from "@/lib/workos";
import { SelectOrgList } from "./SelectOrgList";

function sanitize(returnTo: string | string[] | undefined): string {
  const v = Array.isArray(returnTo) ? returnTo[0] : returnTo;
  if (!v || !v.startsWith("/") || v.startsWith("//")) return "/dashboard";
  return v;
}

export default async function SelectOrg({
  searchParams,
}: PageProps<"/select-org">) {
  const sp = await searchParams;
  const returnTo = sanitize(sp.redirect_url);
  const session = await requireSession();
  const memberships = await listMemberships(session.userId);
  const active = memberships.filter((m) => m.status === "active");

  if (active.length === 0) {
    redirect("/onboarding");
  }
  if (active.length === 1) {
    // Auto-pin via the /switch-org route handler. We can't call
    // switchToOrganization directly from a Server Component render — it
    // rotates the session cookie, which Next only allows in Route Handlers
    // or Server Actions.
    const params = new URLSearchParams({
      org: active[0].organizationId,
      returnTo,
    });
    redirect(`/switch-org?${params.toString()}`);
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-center text-2xl font-semibold">Choose a clinic</h1>
        <p className="mt-2 text-center text-sm text-zinc-600 dark:text-zinc-400">
          You belong to multiple organizations. Pick one to continue.
        </p>
        <SelectOrgList
          memberships={active.map((m) => ({
            organizationId: m.organizationId,
            organizationName: m.organizationName,
            role: m.role ?? null,
          }))}
          returnTo={returnTo}
        />
      </div>
    </main>
  );
}
