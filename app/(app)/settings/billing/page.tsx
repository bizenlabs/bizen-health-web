import { requireRole } from "@/lib/auth";
import {
  getCustomerProfile,
  getInvoices,
  getPlans,
  getSubscription,
} from "@/lib/billing";
import { GstProfileForm } from "./_components/gst-profile-form";
import { InvoiceList } from "./_components/invoice-list";
import { PlanPicker } from "./_components/plan-picker";
import { SubscriptionSummary } from "./_components/subscription-summary";

/**
 * The clinic's own billing screen — and the escape hatch for a lapsed tenant.
 * Core exempts `/v1/billing/**` from the read-only write boundary precisely so
 * this page keeps working when nothing else does.
 */
export default async function BillingSettingsPage() {
  await requireRole("tenant_admin", "super_admin");

  const [subscription, plans, invoices, profile] = await Promise.all([
    getSubscription(),
    getPlans(),
    getInvoices(),
    getCustomerProfile(),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Billing</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Your plan, payment history and the details that appear on your invoices.
      </p>

      <div className="mt-8">
        <SubscriptionSummary subscription={subscription} />
      </div>

      <section className="mt-10">
        <h2 className="text-base font-semibold">Plans</h2>
        <PlanPicker
          className="mt-4"
          plans={plans}
          currentPlanCode={subscription.planCode}
          pendingPlanCode={subscription.pendingPlanCode}
          hasProfile={profile !== null}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold">Billing details</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Used on your tax invoices. The state you select is your place of
          supply, which determines how GST is charged — it can&apos;t be
          corrected after an invoice is issued.
        </p>
        <GstProfileForm className="mt-4" profile={profile} />
      </section>

      <section className="mt-10">
        <h2 className="text-base font-semibold">Payment history</h2>
        <InvoiceList className="mt-4" invoices={invoices} />
      </section>
    </div>
  );
}
