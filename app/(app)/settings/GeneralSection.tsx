import { OrgNameForm } from "./OrgNameForm";

type Props = {
  orgName: string;
  tenantSlug: string | null;
  organizationId: string;
  orgType: string | null;
  isAdmin: boolean;
};

function ReadOnlyField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-sm">{value ?? "—"}</div>
    </div>
  );
}

export function GeneralSection({
  orgName,
  tenantSlug,
  organizationId,
  orgType,
  isAdmin,
}: Props) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">
        General
      </h2>

      {isAdmin ? (
        <OrgNameForm initialName={orgName} />
      ) : (
        <div className="mt-3">
          <ReadOnlyField label="Workspace name" value={orgName} />
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ReadOnlyField label="Slug" value={tenantSlug} />
        <ReadOnlyField label="Account type" value={orgType} />
        <ReadOnlyField label="Organization ID" value={organizationId} />
      </div>
    </section>
  );
}
