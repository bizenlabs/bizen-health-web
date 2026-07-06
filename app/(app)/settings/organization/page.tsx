import { requireRole } from "@/lib/auth";
import { getBranding } from "@/lib/organization";
import { BrandingForm } from "./_components/branding-form";
import { LogoInput } from "./_components/logo-input";

export default async function OrganizationSettingsPage() {
  await requireRole("tenant_admin", "super_admin");

  const branding = await getBranding();

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold">Organization</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Your clinic&apos;s name, contact details and logo. These appear on the
        documents you produce — dictation exports today, invoices later.
      </p>

      <section className="mt-8">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
          Logo
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Shown on document letterheads. JPEG or PNG, up to 1MB.
        </p>
        <LogoInput initialHasLogo={branding.hasLogo} className="mt-4" />
      </section>

      <div className="my-8 h-px bg-zinc-950/10 dark:bg-white/10" />

      <section>
        <h2 className="text-base font-semibold text-zinc-950 dark:text-white">
          Details
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Left blank, the name falls back to your registered workspace name (
          {branding.effectiveDisplayName}).
        </p>
        <BrandingForm branding={branding} className="mt-4" />
      </section>
    </div>
  );
}
