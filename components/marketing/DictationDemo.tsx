"use client";

import { useEffect, useState } from "react";

/* The hero vignette: a consultation note writing itself from dictation.
   It mirrors real product behaviour — empty template sections sit dimmed
   until text lands in them, the red caret marks where live dictation goes,
   and spoken commands ("next section", "scratch that") appear as chips. */

const SECTION_TITLES = ["Chief complaint", "Examination", "Advice"];

type Step =
  | { kind: "word"; section: number; text: string }
  | { kind: "chip"; label: string }
  | { kind: "erase"; section: number; count: number }
  | { kind: "saved" }
  | { kind: "reset" };

function speak(section: number, text: string): Step[] {
  return text
    .split(" ")
    .map((word) => ({ kind: "word" as const, section, text: word }));
}

const SCRIPT: Step[] = [
  ...speak(0, "Fever and body ache for three days, worse at night."),
  { kind: "chip", label: "next section" },
  ...speak(1, "Temp 101.4, throat congested, chest clear, no rash."),
  { kind: "chip", label: "next section" },
  ...speak(2, "Tab paracetamol 650 twice daily"),
  { kind: "chip", label: "scratch that" },
  { kind: "erase", section: 2, count: 2 },
  ...speak(2, "thrice daily after food for three days."),
  { kind: "saved" },
  { kind: "reset" },
];

/* The note as it reads once the script has fully played — shown statically
   when the visitor prefers reduced motion. */
const FINAL_NOTE: string[][] = (() => {
  const sections: string[][] = SECTION_TITLES.map(() => []);
  for (const step of SCRIPT) {
    if (step.kind === "word") sections[step.section].push(step.text);
    if (step.kind === "erase") sections[step.section].splice(-step.count);
  }
  return sections;
})();

const EMPTY_NOTE: string[][] = SECTION_TITLES.map(() => []);

export default function DictationDemo() {
  const [sections, setSections] = useState<string[][]>(EMPTY_NOTE);
  const [cursor, setCursor] = useState(0);
  const [chip, setChip] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let index = 0;
    let timer: number;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timer = window.setTimeout(() => {
        setSections(FINAL_NOTE);
        setCursor(SECTION_TITLES.length - 1);
        setSaved(true);
      }, 0);
      return () => window.clearTimeout(timer);
    }

    const tick = () => {
      const step = SCRIPT[index % SCRIPT.length];
      index += 1;
      let delay = 130;

      switch (step.kind) {
        case "word":
          setChip(null);
          setCursor(step.section);
          setSections((prev) =>
            prev.map((words, i) =>
              i === step.section ? [...words, step.text] : words,
            ),
          );
          delay = step.text.endsWith(",") ? 300 : 130;
          break;
        case "chip":
          setChip(step.label);
          delay = 1100;
          break;
        case "erase":
          setChip(null);
          setSections((prev) =>
            prev.map((words, i) =>
              i === step.section ? words.slice(0, -step.count) : words,
            ),
          );
          delay = 450;
          break;
        case "saved":
          setChip(null);
          setSaved(true);
          delay = 3200;
          break;
        case "reset":
          setSections(EMPTY_NOTE);
          setCursor(0);
          setSaved(false);
          delay = 700;
          break;
      }

      timer = window.setTimeout(tick, delay);
    };

    timer = window.setTimeout(tick, 900);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="w-full max-w-md rounded-2xl border border-[var(--m-line)] bg-white shadow-[0_1px_2px_rgb(21_38_34/0.04),0_12px_32px_-12px_rgb(21_38_34/0.12)]">
      <style>{`@keyframes m-caret-blink { 50% { opacity: 0; } }`}</style>

      <div className="flex items-center justify-between border-b border-[var(--m-line)] px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold">Consultation note</p>
          <p className="text-xs text-[var(--m-muted)]">R. Sharma · 42 · F</p>
        </div>
        {saved ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--m-panel)] px-2.5 py-1 text-xs font-medium text-[var(--m-green)]">
            <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
              <path
                d="M2 6.5 4.5 9 10 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Saved to record
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            Recording
          </span>
        )}
      </div>

      <div className="space-y-4 px-5 py-4">
        {SECTION_TITLES.map((title, i) => {
          const filled = sections[i].length > 0;
          const active = !saved && cursor === i;
          return (
            <div
              key={title}
              className={`transition-opacity duration-300 ${
                filled || active ? "opacity-100" : "opacity-40"
              }`}
            >
              <p className="text-[11px] font-semibold tracking-[0.08em] text-[var(--m-muted)] uppercase">
                {title}
              </p>
              <p className="mt-1 min-h-[2.6rem] text-sm leading-relaxed">
                {sections[i].join(" ")}
                {active && (
                  <span
                    aria-hidden="true"
                    className="ml-0.5 inline-block h-[1.05em] w-0.5 translate-y-[0.15em] [animation:m-caret-blink_1.1s_steps(1,start)_infinite] rounded-full bg-red-500 motion-reduce:animate-none"
                  />
                )}
                {active && chip && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--m-ink)] px-2 py-0.5 align-middle text-[11px] font-medium text-white">
                    <svg
                      viewBox="0 0 12 12"
                      className="h-2.5 w-2.5"
                      aria-hidden="true"
                    >
                      <rect
                        x="4.5"
                        y="1.5"
                        width="3"
                        height="6"
                        rx="1.5"
                        fill="currentColor"
                      />
                      <path
                        d="M2.5 6a3.5 3.5 0 0 0 7 0M6 9.5V11"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                      />
                    </svg>
                    “{chip}”
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
