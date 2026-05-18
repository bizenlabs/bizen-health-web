"use client";

import { useState } from "react";
import type { TemplateSummary } from "@/lib/templates";
import { DictationIntake, type DictationChoice } from "./dictation-intake";
import { DictationRecorder } from "./dictation-recorder";

// Drives one dictation from intake to recording. The clinician first picks a
// template + microphone in the intake step; once chosen, the recorder takes
// over. "Change" on the recorder drops back to intake to re-pick.
export function DictationSession({
  templates,
}: {
  templates: TemplateSummary[];
}) {
  const [choice, setChoice] = useState<DictationChoice | null>(null);

  if (!choice) {
    return <DictationIntake templates={templates} onReady={setChoice} />;
  }

  return (
    <DictationRecorder
      templateId={choice.templateId}
      templateName={choice.templateName}
      deviceId={choice.deviceId}
      onChangeSetup={() => setChoice(null)}
    />
  );
}
