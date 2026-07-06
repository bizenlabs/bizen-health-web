"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/catalyst/button";
import { Field, FieldGroup, Label } from "@/components/catalyst/fieldset";
import { Input } from "@/components/catalyst/input";
import { Textarea } from "@/components/catalyst/textarea";
import type { OrgBranding } from "@/lib/organization";
import { updateBrandingAction } from "../actions";

type FormState = {
  displayName: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  registrationNo: string;
  taxId: string;
};

function toForm(b: OrgBranding): FormState {
  return {
    displayName: b.displayName ?? "",
    tagline: b.tagline ?? "",
    address: b.address ?? "",
    phone: b.phone ?? "",
    email: b.email ?? "",
    website: b.website ?? "",
    registrationNo: b.registrationNo ?? "",
    taxId: b.taxId ?? "",
  };
}

export function BrandingForm({
  branding,
  className,
}: {
  branding: OrgBranding;
  className?: string;
}) {
  const [form, setForm] = useState<FormState>(() => toForm(branding));
  const [saved, setSaved] = useState<FormState>(() => toForm(branding));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = (Object.keys(form) as (keyof FormState)[]).some(
    (k) => form[k].trim() !== saved[k].trim(),
  );

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSuccess(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await updateBrandingAction({
          displayName: form.displayName.trim(),
          tagline: form.tagline.trim(),
          address: form.address.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          website: form.website.trim(),
          registrationNo: form.registrationNo.trim(),
          taxId: form.taxId.trim(),
        });
        setSaved(form);
        setSuccess("Organization details saved");
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Failed to save organization details",
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      <FieldGroup>
        <Field>
          <Label>Display name</Label>
          <Input
            name="displayName"
            value={form.displayName}
            maxLength={200}
            placeholder={branding.effectiveDisplayName}
            onChange={(e) => set("displayName", e.target.value)}
          />
        </Field>

        <Field>
          <Label>Tagline</Label>
          <Input
            name="tagline"
            value={form.tagline}
            maxLength={255}
            onChange={(e) => set("tagline", e.target.value)}
          />
        </Field>

        <Field>
          <Label>Address</Label>
          <Textarea
            name="address"
            value={form.address}
            rows={3}
            onChange={(e) => set("address", e.target.value)}
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field>
            <Label>Phone</Label>
            <Input
              name="phone"
              type="tel"
              value={form.phone}
              maxLength={40}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>

          <Field>
            <Label>Email</Label>
            <Input
              name="email"
              type="email"
              value={form.email}
              maxLength={320}
              onChange={(e) => set("email", e.target.value)}
            />
          </Field>

          <Field>
            <Label>Website</Label>
            <Input
              name="website"
              type="url"
              value={form.website}
              maxLength={255}
              onChange={(e) => set("website", e.target.value)}
            />
          </Field>

          <Field>
            <Label>Registration / license no.</Label>
            <Input
              name="registrationNo"
              value={form.registrationNo}
              maxLength={100}
              onChange={(e) => set("registrationNo", e.target.value)}
            />
          </Field>

          <Field>
            <Label>GSTIN / tax ID</Label>
            <Input
              name="taxId"
              value={form.taxId}
              maxLength={64}
              onChange={(e) => set("taxId", e.target.value)}
            />
          </Field>
        </div>
      </FieldGroup>

      <div className="mt-6 flex items-center gap-3">
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save changes"}
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
