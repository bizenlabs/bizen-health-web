import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { listMemberships } from "@/lib/workos";
import { switchOrgAction } from "./actions";

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
        <ul className="mt-8 space-y-2">
          {active.map((m) => (
            <li key={m.id}>
              <form
                action={switchOrgAction.bind(null, m.organizationId, returnTo)}
              >
                <button
                  type="submit"
                  className="flex w-full items-center justify-between rounded-md border border-zinc-200 px-4 py-3 text-left text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
                >
                  <span className="font-medium">{m.organizationName}</span>
                  <span className="text-xs text-zinc-500">
                    {m.role?.slug ?? ""}
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
