import { requireRole } from "@/lib/auth";
import { listProviders } from "@/lib/providers";
import {
  listProviderAvailability,
  listSlots,
  type AppointmentSlot,
  type ProviderAvailability,
} from "@/lib/appointments";
import { todayClinicISODate } from "@/lib/datetime";
import { AvailabilityEditor } from "./_components/availability-editor";
import { ProviderSelect } from "./_components/provider-select";
import { SlotManager } from "./_components/slot-manager";

function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
    x.getDate(),
  ).padStart(2, "0")}`;
}

export default async function SchedulingPage({
  searchParams,
}: PageProps<"/settings/scheduling">) {
  await requireRole("tenant_admin", "super_admin");
  const sp = await searchParams;
  const providerId = one(sp.providerId);

  const providers = await listProviders();

  let availability: ProviderAvailability[] = [];
  let slots: AppointmentSlot[] = [];
  if (providerId) {
    const today = todayClinicISODate();
    [availability, slots] = await Promise.all([
      listProviderAvailability(providerId),
      listSlots(providerId, today, addDays(today, 27)),
    ]);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Scheduling</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Configure each provider&apos;s weekly availability and generate the
        bookable slots patients can be booked into.
      </p>

      <div className="mt-6">
        <span className="block text-xs text-zinc-500">Provider</span>
        <div className="mt-1">
          <ProviderSelect providers={providers} selected={providerId} />
        </div>
      </div>

      {providerId ? (
        <>
          <AvailabilityEditor
            providerId={providerId}
            availability={availability}
          />
          <SlotManager providerId={providerId} slots={slots} />
        </>
      ) : (
        <p className="mt-8 text-sm text-zinc-500">
          Select a provider to manage their schedule.
        </p>
      )}
    </div>
  );
}
