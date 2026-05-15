import { type ComponentProps } from "react";
import { Badge } from "@/components/catalyst/badge";
import type { AppointmentStatus } from "@/lib/appointments";

type BadgeColor = ComponentProps<typeof Badge>["color"];

const STATUS: Record<AppointmentStatus, { color: BadgeColor; label: string }> =
  {
    SCHEDULED: { color: "zinc", label: "Scheduled" },
    CHECKED_IN: { color: "blue", label: "Checked in" },
    COMPLETED: { color: "emerald", label: "Completed" },
    CANCELLED: { color: "amber", label: "Cancelled" },
    NO_SHOW: { color: "red", label: "No-show" },
  };

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const s = STATUS[status];
  return <Badge color={s.color}>{s.label}</Badge>;
}
