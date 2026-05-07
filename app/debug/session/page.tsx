// Temporary debug page — remove before PR1 ships.
import { getSession, workos } from "@/lib/workos";

function dump(label: string, value: unknown) {
  return (
    <div>
      <h2 className="mt-6 mb-2 font-semibold">{label}</h2>
      <pre className="overflow-auto rounded bg-zinc-100 p-4 text-xs dark:bg-zinc-900">
        {JSON.stringify(
          value,
          (_k, v) => (v instanceof Error ? `${v.name}: ${v.message}` : v),
          2,
        )}
      </pre>
    </div>
  );
}

export default async function DebugSession() {
  let session: unknown = null;
  let sessionErr: unknown = null;
  try {
    session = await getSession();
  } catch (err) {
    sessionErr = {
      name: (err as Error)?.name,
      message: (err as Error)?.message,
      stack: (err as Error)?.stack?.split("\n").slice(0, 8),
    };
  }

  let rawOrg: unknown = null;
  let orgErr: unknown = null;
  const orgId =
    session && typeof session === "object" && "organizationId" in session
      ? (session as { organizationId: string | null }).organizationId
      : null;
  if (orgId) {
    try {
      rawOrg = await workos.organizations.getOrganization(orgId);
    } catch (err) {
      orgErr = {
        name: (err as Error)?.name,
        message: (err as Error)?.message,
      };
    }
  }

  return (
    <div className="px-6 py-10 font-mono text-sm">
      <h1 className="mb-4 text-xl font-semibold">Session debug</h1>

      {dump("getSession() result", session)}
      {sessionErr ? dump("getSession() ERROR", sessionErr) : null}

      {dump("Raw Organization (from WorkOS)", rawOrg)}
      {orgErr ? dump("Organization fetch ERROR", orgErr) : null}

      <p className="mt-6 text-zinc-500">
        Look for: <code>organizationId</code> set,{" "}
        <code>metadata.tenant_slug</code> set (exact snake_case key).
      </p>
    </div>
  );
}
