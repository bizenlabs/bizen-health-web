"use client";

import { Description, Label } from "@/components/catalyst/fieldset";
import { Switch, SwitchField, SwitchGroup } from "@/components/catalyst/switch";
import {
  SPOKEN_PUNCTUATION_DEFAULT,
  SPOKEN_PUNCTUATION_KEY,
  useStoredBool,
  VOICE_COMMANDS_DEFAULT,
  VOICE_COMMANDS_KEY,
} from "@/lib/transcription/dictation-prefs";

// Personal dictation preferences — the same toggles as the in-recording
// Commands popover, surfaced here so they can be set outside a recording.
// Stored per browser (localStorage), so they follow the device, not the
// account; a recording already in progress keeps its current stream settings.
export function DictationSection() {
  const [voiceCommands, setVoiceCommands] = useStoredBool(
    VOICE_COMMANDS_KEY,
    VOICE_COMMANDS_DEFAULT,
  );
  const [punctuation, setPunctuation] = useStoredBool(
    SPOKEN_PUNCTUATION_KEY,
    SPOKEN_PUNCTUATION_DEFAULT,
  );

  return (
    <section>
      <h2 className="text-base font-semibold">Dictation</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Your personal dictation preferences on this device. They can also be
        changed from the Commands panel while recording.
      </p>
      <SwitchGroup className="mt-6 max-w-xl">
        <SwitchField>
          <Label>Voice commands</Label>
          <Description>
            Spoken “new line”, “next section”, “scratch that”, etc. act on the
            note instead of being typed out.
          </Description>
          <Switch checked={voiceCommands} onChange={setVoiceCommands} />
        </SwitchField>
        <SwitchField>
          <Label>Spoken punctuation</Label>
          <Description>
            Dictate punctuation yourself — “period”, “comma”, “new paragraph”.
            While this is on, automatic punctuation is turned off so it
            doesn&apos;t fight your spoken marks.
          </Description>
          <Switch checked={punctuation} onChange={setPunctuation} />
        </SwitchField>
      </SwitchGroup>
    </section>
  );
}
