import { describe, expect, it } from "vitest";
import {
  bannerFor,
  daysUntil,
  formatAmount,
  isWriteBlocked,
  needsAttention,
  statusLabel,
} from "./billing-status";

const NOW = new Date("2026-08-08T12:00:00Z"); // fixed clock for determinism

const inDays = (days: number) =>
  new Date(NOW.getTime() + days * 86_400_000).toISOString();

describe("daysUntil", () => {
  it("rounds up so a partial day still reads as a day", () => {
    // 22 hours left should say "1 day", not "0 days".
    expect(daysUntil(inDays(0.9), NOW)).toBe(1);
    expect(daysUntil(inDays(3), NOW)).toBe(3);
  });

  it("goes negative once the deadline has passed", () => {
    expect(daysUntil(inDays(-2), NOW)).toBeLessThan(0);
  });

  it("returns null for a missing or unparseable deadline", () => {
    expect(daysUntil(null, NOW)).toBeNull();
    expect(daysUntil("not-a-date", NOW)).toBeNull();
  });
});

describe("isWriteBlocked", () => {
  it("blocks only the terminal states", () => {
    expect(isWriteBlocked("read_only")).toBe(true);
    expect(isWriteBlocked("cancelled")).toBe(true);
  });

  it("leaves trialing, active and past_due writable", () => {
    // Grace is the whole point of past_due: a failed card must not stop a
    // clinic mid-consultation.
    expect(isWriteBlocked("trialing")).toBe(false);
    expect(isWriteBlocked("active")).toBe(false);
    expect(isWriteBlocked("past_due")).toBe(false);
    expect(isWriteBlocked(null)).toBe(false);
  });
});

describe("needsAttention", () => {
  it("stays quiet for an active subscription", () => {
    expect(needsAttention("active", null, NOW)).toBe(false);
  });

  it("stays quiet early in a trial", () => {
    expect(needsAttention("trialing", inDays(10), NOW)).toBe(false);
  });

  it("speaks up in the last few days of a trial", () => {
    expect(needsAttention("trialing", inDays(3), NOW)).toBe(true);
    expect(needsAttention("trialing", inDays(1), NOW)).toBe(true);
  });

  it("always speaks up once payment has failed", () => {
    expect(needsAttention("past_due", inDays(7), NOW)).toBe(true);
    expect(needsAttention("read_only", null, NOW)).toBe(true);
    expect(needsAttention("cancelled", null, NOW)).toBe(true);
  });
});

describe("bannerFor", () => {
  it("renders nothing when there is nothing to say", () => {
    expect(bannerFor("active", null, NOW)).toBeNull();
    expect(bannerFor("trialing", inDays(10), NOW)).toBeNull();
    expect(bannerFor(null, null, NOW)).toBeNull();
  });

  it("counts down a trial", () => {
    const banner = bannerFor("trialing", inDays(2), NOW);

    expect(banner?.severity).toBe("info");
    expect(banner?.message).toContain("2 days");
    expect(banner?.dismissible).toBe(true);
  });

  it("uses the singular on the last day", () => {
    expect(bannerFor("trialing", inDays(1), NOW)?.message).toContain("1 day");
    expect(bannerFor("trialing", inDays(1), NOW)?.message).not.toContain(
      "1 days",
    );
  });

  it("names the read-only date while in grace", () => {
    const banner = bannerFor("past_due", inDays(5), NOW);

    expect(banner?.severity).toBe("warning");
    expect(banner?.message).toContain("5 days");
    expect(banner?.ctaLabel).toBe("Update payment method");
  });

  it("cannot be dismissed once the workspace is degraded", () => {
    expect(bannerFor("read_only", null, NOW)?.dismissible).toBe(false);
    expect(bannerFor("cancelled", null, NOW)?.dismissible).toBe(false);
  });

  it("tells a read-only tenant what still works", () => {
    // A clinic that lost write access has not lost its records, and the copy
    // must not imply otherwise.
    const banner = bannerFor("read_only", null, NOW);

    expect(banner?.message).toContain("view and export");
  });

  it("reassures a cancelled tenant that its data is retained", () => {
    expect(bannerFor("cancelled", null, NOW)?.message).toContain(
      "data is safe",
    );
  });
});

describe("statusLabel", () => {
  it("gives every status a human label", () => {
    expect(statusLabel("trialing")).toBe("Free trial");
    expect(statusLabel("active")).toBe("Active");
    expect(statusLabel("past_due")).toBe("Payment failed");
    expect(statusLabel("read_only")).toBe("Read-only");
    expect(statusLabel("cancelled")).toBe("Cancelled");
    expect(statusLabel(null)).toBe("Unknown");
  });
});

describe("formatAmount", () => {
  it("renders whole-rupee pricing without decimal noise", () => {
    expect(formatAmount(499900)).toBe("₹4,999");
    expect(formatAmount(149900)).toBe("₹1,499");
  });

  it("groups in the Indian numbering system", () => {
    // 49,990 not 49,990 as 4-9-9-9-0 grouped western-style.
    expect(formatAmount(4999000)).toBe("₹49,990");
  });

  it("keeps paise when a price actually has them", () => {
    expect(formatAmount(149950)).toBe("₹1,499.50");
  });
});
