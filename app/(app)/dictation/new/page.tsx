import Link from "next/link";
import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { requireSession } from "@/lib/auth";
import { listTemplates, type TemplateSummary } from "@/lib/templates";
import { DictationSession } from "../_components/dictation-session";

// New dictation — the setup panel. Reached from the library's "New dictation"
// action. On stop the recorder navigates to /dictation/[id].
export default async function NewDictationPage() {
  await requireSession();

  // Templates feed the intake picker — a convenience, not a prerequisite
  // (free-form works regardless), so a failed fetch degrades to an empty picker.
  let templates: TemplateSummary[] = [];
  try {
    templates = await listTemplates();
  } catch {
    templates = [];
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10 sm:py-12">
      <Link
        href="/dictation"
        className="inline-flex items-center gap-1 font-mono text-[11px] font-medium tracking-[0.15em] text-zinc-400 uppercase transition-colors hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        <ChevronLeftIcon className="size-3.5" />
        Dictation
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
        New dictation
      </h1>
      <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        Audio is not stored — only the transcript.
      </p>

      <div className="mt-6">
        <DictationSession templates={templates} />
      </div>
    </div>
  );
}
