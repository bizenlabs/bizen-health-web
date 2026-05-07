import { requireSession } from "@/lib/auth";

export default async function Dashboard() {
  const session = await requireSession();
  return (
    <div className="px-6 py-10">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Active org:{" "}
        <code className="font-mono">
          {session.tenantSlug ?? session.organizationId}
        </code>
      </p>
    </div>
  );
}
