"use client";

import clsx from "clsx";
import { Badge } from "@/components/catalyst/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { formatAmount } from "@/lib/billing-status";
import type { BillingInvoice } from "@/lib/billing";

const STATUS_COLOR = {
  PAID: "green",
  FAILED: "red",
  REFUNDED: "zinc",
} as const;

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

/**
 * Payment receipts, newest first.
 *
 * These are records of what was charged, not GST tax invoices — those carry our
 * GSTIN and a numbered series, and are issued separately.
 */
export function InvoiceList({
  invoices,
  className,
}: {
  invoices: BillingInvoice[];
  className?: string;
}) {
  if (invoices.length === 0) {
    return (
      <p className={clsx(className, "text-sm text-zinc-500")}>
        No payments yet.
      </p>
    );
  }

  return (
    <div className={className}>
      <Table dense>
        <TableHead>
          <TableRow>
            <TableHeader>Date</TableHeader>
            <TableHeader>Amount</TableHeader>
            <TableHeader>Method</TableHeader>
            <TableHeader>Status</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>{formatDate(invoice.paidAt)}</TableCell>
              <TableCell>
                {formatAmount(invoice.amountMinor, invoice.currency)}
              </TableCell>
              <TableCell className="uppercase">
                {invoice.method ?? "—"}
              </TableCell>
              <TableCell>
                <Badge color={STATUS_COLOR[invoice.status]}>
                  {invoice.status.toLowerCase()}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <p className="mt-3 text-xs text-zinc-500">
        Need a GST tax invoice? Contact support and we&apos;ll email it to you.
      </p>
    </div>
  );
}
