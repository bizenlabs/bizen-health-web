"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/catalyst/button";
import { Field, Label } from "@/components/catalyst/fieldset";
import { Select } from "@/components/catalyst/select";
import { TRANSCRIPTION_LANGUAGES } from "@/lib/transcription/languages";
import { updateTranscriptionLanguageAction } from "../actions";

export function TranscriptionLanguageForm({
  initialLanguage,
}: {
  initialLanguage: string;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const [savedLanguage, setSavedLanguage] = useState(initialLanguage);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = language !== savedLanguage;

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await updateTranscriptionLanguageAction(language);
        setSavedLanguage(language);
        setSuccess("Transcription language updated");
      } catch (err) {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "Failed to update transcription language",
        );
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md">
      <Field>
        <Label>Language &amp; accent</Label>
        <Select
          name="transcription-language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <optgroup label="English">
            {TRANSCRIPTION_LANGUAGES.filter((l) => l.group === "English").map(
              (l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ),
            )}
          </optgroup>
          <optgroup label="Indian languages">
            {TRANSCRIPTION_LANGUAGES.filter(
              (l) => l.group === "Indian languages",
            ).map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </optgroup>
        </Select>
      </Field>

      <p className="mt-2 text-xs text-zinc-500">
        English options use a medical-tuned model for better drug and clinical
        terminology. Non-English options use the general model (no medical
        tuning) — your dictionary terms still apply. &quot;Hindi + English
        (mixed)&quot; transcribes both in one recording for clinicians who
        switch between them.
      </p>

      <div className="mt-4 flex items-center gap-3">
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
