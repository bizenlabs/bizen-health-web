"use client";

import { Popover, PopoverButton, PopoverPanel } from "@headlessui/react";
import { CalendarIcon } from "@heroicons/react/16/solid";
import clsx from "clsx";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import "./date-picker-theme.css";

type Props = {
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  invalid?: boolean;
  defaultYearsAgo?: number;
};

export function DatePicker({
  name,
  value = "",
  onChange,
  min,
  max,
  placeholder = "Pick a date",
  invalid,
  defaultYearsAgo = 30,
}: Props) {
  const selected = parseISO(value);
  const minDate = parseISO(min);
  const maxDate = parseISO(max);
  const startMonth = minDate ?? new Date(new Date().getFullYear() - 130, 0);
  const endMonth = maxDate ?? new Date();
  const disabled = [
    ...(minDate ? [{ before: minDate }] : []),
    ...(maxDate ? [{ after: maxDate }] : []),
  ];

  const defaultMonth =
    selected ??
    new Date(new Date().getFullYear() - defaultYearsAgo, new Date().getMonth());

  const display = selected ? formatDisplay(selected) : "";

  return (
    <Popover className="relative">
      <span
        data-slot="control"
        className={clsx(
          "relative block w-full",
          "before:absolute before:inset-px before:rounded-[calc(var(--radius-lg)-1px)] before:bg-white before:shadow-sm",
          "dark:before:hidden",
        )}
      >
        <PopoverButton
          className={clsx(
            "relative block w-full appearance-none rounded-lg px-[calc(--spacing(3.5)-1px)] py-[calc(--spacing(2.5)-1px)] sm:px-[calc(--spacing(3)-1px)] sm:py-[calc(--spacing(1.5)-1px)]",
            "flex items-center justify-between gap-2",
            "text-left text-base/6 sm:text-sm/6",
            "border border-zinc-950/10 hover:border-zinc-950/20 dark:border-white/10 dark:hover:border-white/20",
            "bg-transparent dark:bg-white/5",
            "focus:outline-none data-focus:ring-2 data-focus:ring-blue-500",
            invalid &&
              "border-red-500 hover:border-red-500 dark:border-red-600 dark:hover:border-red-600",
          )}
        >
          <span
            className={clsx(
              display
                ? "text-zinc-950 dark:text-white"
                : "text-zinc-500 dark:text-zinc-400",
            )}
          >
            {display || placeholder}
          </span>
          <CalendarIcon
            className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400"
            aria-hidden="true"
          />
        </PopoverButton>
      </span>

      <input type="hidden" name={name} value={value} />

      <PopoverPanel
        anchor={{ to: "bottom start", gap: 8 }}
        transition
        className={clsx(
          "z-50 rounded-xl border border-zinc-950/10 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-zinc-900",
          "transition duration-150 ease-out data-closed:scale-95 data-closed:opacity-0",
        )}
      >
        {({ close }) => (
          <DayPicker
            mode="single"
            selected={selected}
            defaultMonth={defaultMonth}
            startMonth={startMonth}
            endMonth={endMonth}
            disabled={disabled}
            captionLayout="dropdown"
            showOutsideDays
            onSelect={(d) => {
              onChange?.(d ? toISO(d) : "");
              if (d) close();
            }}
          />
        )}
      </PopoverPanel>
    </Popover>
  );
}

function parseISO(s: string | undefined | null): Date | undefined {
  if (!s) return undefined;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  ) {
    return undefined;
  }
  return date;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplay(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
