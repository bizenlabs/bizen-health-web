"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/catalyst/button";
import { Field, FieldGroup, Label } from "@/components/catalyst/fieldset";
import { Input } from "@/components/catalyst/input";
import { Select } from "@/components/catalyst/select";
import { Textarea } from "@/components/catalyst/textarea";
import type { BillingCustomerProfile } from "@/lib/billing";
import { GST_STATES, stateCodeFromGstin } from "@/lib/gst-states";
import { saveCustomerProfileAction } from "../actions";

type FormState = {
  legalName: string;
  gstin: string;
  billingAddress: string;
  stateCode: string;
  billingEmail: string;
};

function toForm(profile: BillingCustomerProfile | null): FormState {
  return {
    legalName: profile?.legalName ?? "",
    gstin: profile?.gstin ?? "",
    billingAddress: profile?.billingAddress ?? "",
    stateCode: profile?.stateCode ?? "",
    billingEmail: profile?.billingEmail ?? "",
  };
}

export function GstProfileForm({
  profile,
  className,
}: {
  profile: BillingCustomerProfile | null;
  className?: string;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(profile));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // The first two digits of a GSTIN are its state code, so a mismatch is a
  // data-entry error worth catching before an invoice goes out.
  const gstinState = stateCodeFromGstin(form.gstin);
  const stateMismatch =
    gstinState !== null &&
    form.stateCode !== "" &&
    gstinState !== form.stateCode;

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSuccess(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await saveCustomerProfileAction({
        legalName: form.legalName,
        gstin: form.gstin || null,
        billingAddress: form.billingAddress,
        stateCode: form.stateCode,
        billingEmail: form.billingEmail || null,
      });
      if (result.ok) setSuccess("Billing details saved");
      else setError(result.error);
    });
  }

  return (
    <form className={className} onSubmit={onSubmit}>
      <FieldGroup>
        <Field>
          <Label>Registered legal name</Label>
          <Input
            value={form.legalName}
            onChange={(e) => set("legalName", e.target.value)}
            placeholder="Sunrise Healthcare Pvt Ltd"
            required
          />
        </Field>

        <Field>
          <Label>GSTIN (optional)</Label>
          <Input
            value={form.gstin}
            onChange={(e) => set("gstin", e.target.value.toUpperCase())}
            placeholder="27AAAAA0000A1Z5"
            maxLength={15}
          />
        </Field>

        <Field>
          <Label>Billing address</Label>
          <Textarea
            value={form.billingAddress}
            onChange={(e) => set("billingAddress", e.target.value)}
            rows={3}
            required
          />
        </Field>

        <Field>
          <Label>State (place of supply)</Label>
          <Select
            value={form.stateCode}
            onChange={(e) => set("stateCode", e.target.value)}
            required
          >
            <option value="">Select a state…</option>
            {GST_STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label>Billing email (optional)</Label>
          <Input
            type="email"
            value={form.billingEmail}
            onChange={(e) => set("billingEmail", e.target.value)}
            placeholder="accounts@clinic.example"
          />
        </Field>
      </FieldGroup>

      {stateMismatch ? (
        <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
          Your GSTIN starts with {gstinState}, which doesn&apos;t match the
          state you selected. Check both before saving.
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save billing details"}
        </Button>
        {error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : null}
        {success ? (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {success}
          </p>
        ) : null}
      </div>
    </form>
  );
}
