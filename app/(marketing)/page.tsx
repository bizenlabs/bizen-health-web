import Link from "next/link";
import {
  BookOpenText,
  CalendarClock,
  FileOutput,
  IdCard,
  Mic,
  SlidersHorizontal,
  SpellCheck,
  Table,
  Users,
} from "lucide-react";
import DictationDemo from "@/components/marketing/DictationDemo";

const display = "[font-family:var(--font-display)]";

const steps = [
  {
    title: "Speak",
    body: "Start a dictation from the patient's visit and talk the way you talk. Say “new line”, “next section”, or “scratch that” — the note follows along.",
  },
  {
    title: "Review",
    body: "Your words land in the right sections of your template — chief complaint, examination, advice — as editable text, not a transcript blob.",
  },
  {
    title: "Print and move on",
    body: "Export the note or prescription as a PDF on your clinic's letterhead. It's already saved to the patient's record.",
  },
];

const features = [
  {
    icon: BookOpenText,
    title: "Templates for your specialty",
    body: "Start from the template library or write your own. Patient name, age, and today's date fill themselves in.",
  },
  {
    icon: Mic,
    title: "Voice commands",
    body: "“New line.” “Next section.” “Scratch that.” Edit the note without touching the keyboard mid-consultation.",
  },
  {
    icon: SpellCheck,
    title: "A dictionary that learns your vocabulary",
    body: "Add the drug names and terms you actually use, once — dictation gets them right for the whole clinic.",
  },
  {
    icon: Table,
    title: "Prescriptions that print clean",
    body: "Structured prescription tables — drug, dose, frequency, duration — ready to hand to the patient.",
  },
  {
    icon: FileOutput,
    title: "Your letterhead, automatically",
    body: "Every PDF and Word export carries your clinic's logo, name, and contact details. Set it up once.",
  },
  {
    icon: IdCard,
    title: "Records that match reality",
    body: "No email, no phone, no exact date of birth? Fine. Registration works with the details your patients actually have — estimated ages included.",
  },
];

const clinicPoints = [
  {
    icon: CalendarClock,
    title: "Appointments to visits to notes",
    body: "Scheduling, visits, and every encounter's documentation live on one timeline per patient — nothing gets filed twice.",
  },
  {
    icon: Users,
    title: "The whole team, the right access",
    body: "Invite doctors, reception, and admin staff with roles that match the job. Reception books, doctors document, admins configure.",
  },
  {
    icon: SlidersHorizontal,
    title: "Set up your clinic your way",
    body: "Clinic admins manage visit types, encounter types, and templates themselves — no support ticket needed.",
  },
];

export default function MarketingHome() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pt-16 pb-20 lg:grid-cols-[1.1fr_1fr] lg:pt-24 lg:pb-28">
        <div>
          <p className="text-sm font-medium text-[var(--m-green)]">
            AI dictation + patient records for Indian clinics
          </p>
          <h1
            className={`${display} mt-4 max-w-xl text-4xl leading-[1.1] font-semibold tracking-tight text-balance sm:text-5xl`}
          >
            Finish the note before the patient leaves the room.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-[var(--m-muted)]">
            Speak in your own words. Bizen Health turns it into a structured
            clinical note, a clean prescription, and a printout on your
            clinic&apos;s letterhead — and the record keeps itself.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-5">
            <Link
              href="/sign-up"
              className="inline-flex h-12 items-center rounded-full bg-[var(--m-green)] px-7 text-sm font-medium text-white transition-colors hover:bg-[var(--m-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m-green)]"
            >
              Create free account
            </Link>
            <Link
              href="/#how"
              className="text-sm font-medium text-[var(--m-ink)] underline decoration-[var(--m-line)] underline-offset-4 transition-colors hover:decoration-[var(--m-green)]"
            >
              See how it works
            </Link>
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">
          <DictationDemo />
        </div>
      </section>

      {/* How it works */}
      <section
        id="how"
        className="scroll-mt-16 border-y border-[var(--m-line)] bg-[var(--m-panel)]"
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2
            className={`${display} max-w-md text-3xl font-semibold tracking-tight`}
          >
            One consultation, start to finish
          </h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {steps.map((step, i) => (
              <div key={step.title}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--m-green)] text-sm font-semibold text-white">
                    {i + 1}
                  </span>
                  <h3 className="text-lg font-semibold">{step.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--m-muted)]">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-16">
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2
            className={`${display} max-w-lg text-3xl font-semibold tracking-tight`}
          >
            Built around the way you actually practise
          </h2>
          <div className="mt-12 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title}>
                <feature.icon
                  className="h-5 w-5 text-[var(--m-green)]"
                  aria-hidden="true"
                />
                <h3 className="mt-3 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--m-muted)]">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* For clinics */}
      <section
        id="clinics"
        className="scroll-mt-16 border-y border-[var(--m-line)] bg-[var(--m-panel)]"
      >
        <div className="mx-auto w-full max-w-6xl px-6 py-20">
          <h2
            className={`${display} max-w-lg text-3xl font-semibold tracking-tight`}
          >
            And when the clinic grows, it keeps up
          </h2>
          <div className="mt-12 grid gap-10 sm:grid-cols-3">
            {clinicPoints.map((point) => (
              <div key={point.title}>
                <point.icon
                  className="h-5 w-5 text-[var(--m-green)]"
                  aria-hidden="true"
                />
                <h3 className="mt-3 font-semibold">{point.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--m-muted)]">
                  {point.body}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-12 text-sm text-[var(--m-muted)]">
            Every clinic&apos;s workspace is its own — your team sees your
            patients, and no one else&apos;s.
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto w-full max-w-6xl px-6 py-24 text-center">
        <h2
          className={`${display} mx-auto max-w-md text-3xl font-semibold tracking-tight text-balance`}
        >
          Start with your next patient
        </h2>
        <p className="mx-auto mt-4 max-w-md text-[var(--m-muted)]">
          Create your clinic, pick a template, and dictate your first note in
          minutes.
        </p>
        <Link
          href="/sign-up"
          className="mt-8 inline-flex h-12 items-center rounded-full bg-[var(--m-green)] px-7 text-sm font-medium text-white transition-colors hover:bg-[var(--m-green-dark)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--m-green)]"
        >
          Create free account
        </Link>
      </section>
    </main>
  );
}
